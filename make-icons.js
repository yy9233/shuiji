// 生成 PWA 图标（纯 Node，无第三方依赖）：深灰蓝底 + 蓝色水滴
'use strict';
const zlib = require('zlib');
const fs = require('fs');

/* ---------- 最小 PNG 编码器 ---------- */
let crcTable = null;
function crc32(buf){
  if(!crcTable){
    crcTable = [];
    for(let n=0;n<256;n++){
      let c=n;
      for(let k=0;k<8;k++) c = (c&1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1);
      crcTable[n] = c>>>0;
    }
  }
  let c = 0xFFFFFFFF;
  for(let i=0;i<buf.length;i++) c = crcTable[(c^buf[i])&0xFF] ^ (c>>>8);
  return (c^0xFFFFFFFF)>>>0;
}
function chunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function makePNG(size, px){
  const raw = Buffer.alloc(size * (size*4 + 1));
  let off = 0;
  for(let y=0;y<size;y++){
    raw[off++] = 0;                                   // filter: none
    for(let x=0;x<size;x++){
      const [r,g,b,a] = px(x,y);
      raw[off++]=r; raw[off++]=g; raw[off++]=b; raw[off++]=a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4);
  ihdr[8]=8; ihdr[9]=6;                               // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, {level:9})),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- 图形 ---------- */
function inRoundRect(x, y, S){
  const r = S*0.22, min = r, max = S-r;
  const nx = Math.max(min, Math.min(x, max));
  const ny = Math.max(min, Math.min(y, max));
  const dx = x-nx, dy = y-ny;
  return dx*dx + dy*dy <= r*r;
}
function inDroplet(x, y, cx, cy, R){
  const dx = x-cx, dy = y-cy;
  if(dx*dx + dy*dy <= R*R) return true;               // 水滴主体（圆）
  const ay = cy - 1.6*R, by = cy - 0.55*R, half = 0.55*R;  // 顶部尖角（三角形）
  if(y >= ay && y <= by){
    const t = (y - ay)/(by - ay);
    if(Math.abs(x - cx) <= half * t) return true;
  }
  return false;
}

/* 4x 超采样抗锯齿 */
const SUBS = [[0.25,0.25],[0.25,0.75],[0.75,0.25],[0.75,0.75]];
function makeIconPx(size){
  const cx = size/2, cy = size*0.62, R = size*0.27;
  const BG = [26,42,58], DROP = [79,195,247];         // #1A2A3A / #4FC3F7
  return (x, y) => {
    let inBg = 0, inDrop = 0;
    for(const [sx,sy] of SUBS){
      const px = x+sx, py = y+sy;
      if(inRoundRect(px, py, size)){
        inBg++;
        if(inDroplet(px, py, cx, cy, R)) inDrop++;
      }
    }
    if(inBg === 0) return [0,0,0,0];
    const aDrop = inDrop / inBg;
    const r = Math.round(BG[0]*(1-aDrop) + DROP[0]*aDrop);
    const g = Math.round(BG[1]*(1-aDrop) + DROP[1]*aDrop);
    const b = Math.round(BG[2]*(1-aDrop) + DROP[2]*aDrop);
    return [r, g, b, Math.round((inBg/4)*255)];
  };
}

/* ---------- 输出 ---------- */
const specs = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512]
];
for(const [name, size] of specs){
  fs.writeFileSync(__dirname + '/' + name, makePNG(size, makeIconPx(size)));
  console.log('生成', name, size + 'x' + size);
}
