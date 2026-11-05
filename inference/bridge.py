"""Firebase Admin RTDB -> validated sensor window -> team-ML joblib -> predictions path.

Does NOT train a model. Refuses to start live predictions without an actual model joblib,
model contract, Firebase credentials and RTDB URL. Interlocks must be local to ESP32.

Offline check: python -m inference.bridge --check-example
Live: set GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_DATABASE_URL, MODEL_PATH,
      MODEL_CONTRACT_PATH then python -m inference.bridge
"""
from __future__ import annotations
import argparse
import json
import os
import time
from pathlib import Path
from .feature_builder import FEATURE_NAMES, LABELS, make_features, valid_reading, vector_for_model

HERE = Path(__file__).resolve().parent


def load_contract(path: Path) -> dict:
    contract = json.loads(path.read_text(encoding='utf-8'))
    assert contract['labels'] == list(LABELS), 'Harus 3 kelas pada topik deteksi sumbatan'
    assert contract['feature_names'] and set(contract['feature_names']).issubset(FEATURE_NAMES)
    assert int(contract['window_samples']) >= 3
    assert float(contract['hop_seconds']) >= 1
    assert isinstance(contract['model_version'], str) and contract['model_version']
    return contract


def check_example():
    sample = json.loads((HERE/'examples'/'telemetry-window.json').read_text(encoding='utf-8'))
    contract = load_contract(HERE/'model_contract.example.json')
    features = make_features(sample, int(contract['window_samples']))
    vector = vector_for_model(features, contract)
    print('VALIDASI OFFLINE OK · jumlah sampel:', len(sample), '| fitur:', len(vector))
    print('Contoh fitur (bukan prediksi model):', json.dumps(features, indent=2))
    print('Tidak ada model terlatih yang dijalankan dalam tes ini.')


def run_live():
    import joblib          # pip install -r inference/requirements.txt
    import firebase_admin
    from firebase_admin import credentials, db

    cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    db_url = os.environ.get('FIREBASE_DATABASE_URL')
    model_path = os.environ.get('MODEL_PATH')
    contract_path = os.environ.get('MODEL_CONTRACT_PATH')
    device_id = os.environ.get('AQUAFLOW_DEVICE_ID', 'saluran-01')
    if not all((cred_path, db_url, model_path, contract_path)):
        raise RuntimeError('Butuh GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_DATABASE_URL, MODEL_PATH, MODEL_CONTRACT_PATH')
    for path in (cred_path, model_path, contract_path):
        if not Path(path).is_file():
            raise FileNotFoundError(f'Berkas tidak ada: {path}')
    contract = load_contract(Path(contract_path))
    model = joblib.load(model_path)  # Load ONLY verified, trusted model artifacts from team ML.
    if not hasattr(model, 'predict'):
        raise RuntimeError('Artefak joblib tidak memiliki metode predict')
    firebase_admin.initialize_app(credentials.Certificate(cred_path), {'databaseURL': db_url})
    parent = db.reference(f'/devices/{device_id}')
    last_source_ts = 0
    hop_seconds = float(contract['hop_seconds'])
    sample_count = int(contract['window_samples'])
    print(f'Bridge aktif untuk {device_id}; model {contract["model_version"]}; inferensi per {hop_seconds}s')
    while True:
        try:
            latest_obj = parent.child('latest').get()
            if not valid_reading(latest_obj):
                print('Pembacaan terbaru INVALID; prediksi ditahan.')
                time.sleep(hop_seconds)
                continue
            history_obj = parent.child('history').order_by_child('timestamp').limit_to_last(max(60, sample_count * 4)).get() or {}
            readings = [r for r in history_obj.values() if valid_reading(r)]
            readings.sort(key=lambda r: r['timestamp'])
            if len(readings) < sample_count:
                time.sleep(hop_seconds)
                continue
            source_ts = int(readings[-1]['timestamp'])
            if source_ts != int(latest_obj['timestamp']):
                print('Latest/history belum sinkron; tunda sampai data konsisten.')
                time.sleep(hop_seconds)
                continue
            if source_ts <= last_source_ts or source_ts - last_source_ts < hop_seconds * 1000:
                time.sleep(hop_seconds)
                continue
            if int(time.time()*1000)-source_ts > 30_000:
                print('Data sumber kedaluwarsa; tidak membuat prediksi baru.')
                time.sleep(hop_seconds)
                continue
            features = make_features(readings, sample_count)
            vector = vector_for_model(features, contract)
            label = str(model.predict([vector])[0])
            if label not in LABELS:
                raise ValueError(f'Label model tidak sesuai kontrak: {label!r}')
            confidence = None
            if hasattr(model, 'predict_proba'):
                probabilities = model.predict_proba([vector])[0]
                classes = list(model.classes_)
                confidence = float(probabilities[classes.index(label)])
            event = {'timestamp': int(time.time()*1000), 'sourceTimestamp': source_ts,
                     'label': label, 'source': 'model', 'modelVersion': contract['model_version'],
                     'confidence': confidence}
            # Push history and update latest together in one RTDB multi-location update.
            unique_key = parent.child('predictions/history').push().key
            parent.update({'predictions/latest': event, f'predictions/history/{unique_key}':event})
            last_source_ts = source_ts
            print('Inferensi berhasil:', event['label'], '| data:', source_ts)
        except KeyboardInterrupt:
            print('Bridge dihentikan.');break
        except Exception as exc:
            print(f'Inferensi dilewati: {type(exc).__name__}: {exc}', flush=True)
            # Do not publish an invented prediction or overwrite older results with fake data.
        time.sleep(hop_seconds)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='AquaFlow Python ML inference bridge')
    parser.add_argument('--check-example', action='store_true', help='Check local sensor sample and features without Firebase/model')
    args = parser.parse_args()
    if args.check_example:
        check_example()
    else:
        run_live()
