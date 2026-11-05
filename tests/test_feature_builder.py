import copy
import json
import unittest
from pathlib import Path
from inference.feature_builder import make_features, valid_reading, vector_for_model

ROOT=Path(__file__).resolve().parents[1]
ROWS=json.loads((ROOT/'inference/examples/telemetry-window.json').read_text())
CONTRACT=json.loads((ROOT/'inference/model_contract.example.json').read_text())

class FeatureBuilderTests(unittest.TestCase):
    def test_valid_examples(self):
        self.assertTrue(all(valid_reading(r) for r in ROWS))
        feats=make_features(ROWS)
        self.assertEqual(len(vector_for_model(feats,CONTRACT)),len(CONTRACT['feature_names']))
    def test_reject_missing_sensor(self):
        rows=copy.deepcopy(ROWS); rows[-1]['outletLpm']=None
        with self.assertRaises(ValueError): make_features(rows)
    def test_reject_unsafe(self):
        rows=copy.deepcopy(ROWS);rows[-1]['floatSafe']=False
        with self.assertRaises(ValueError): make_features(rows)
    def test_reject_gap(self):
        rows=copy.deepcopy(ROWS);rows[-1]['timestamp']+=8000
        with self.assertRaises(ValueError): make_features(rows)
    def test_reject_mixed_sessions(self):
        rows=copy.deepcopy(ROWS);rows[-1]['sessionId']='LAIN'
        with self.assertRaises(ValueError): make_features(rows)

if __name__=='__main__': unittest.main()
