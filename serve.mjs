import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('dist');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{res.writeHead(400).end();return;}const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
