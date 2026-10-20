import { WORLD_SIZE } from './game-data.js';

export const LAND_RULES=Object.freeze({chunkSize:8,minChunk:-4,maxChunk:3,seed:20261015,maxNewChunks:48,bodyMargin:.35,ballMargin:.45,reclaimReach:2.2});
const coreMin=-WORLD_SIZE/2/LAND_RULES.chunkSize,coreMax=-coreMin-1;
export const chunkKey=(x,z)=>`${x},${z}`;
export const FACILITY_CHUNKS=Object.freeze(['-2,2','-1,2']);
const core=(x,z)=>x>=coreMin&&x<=coreMax&&z>=coreMin&&z<=coreMax;
export const isFacilityChunk=(x,z)=>FACILITY_CHUNKS.includes(chunkKey(x,z));
const validChunk=(x,z)=>Number.isInteger(x)&&Number.isInteger(z)&&x>=LAND_RULES.minChunk&&x<=LAND_RULES.maxChunk&&z>=LAND_RULES.minChunk&&z<=LAND_RULES.maxChunk;
export const createLand=()=>({seed:LAND_RULES.seed,opened:[],claimed:[]});
export function encounterForChunk(land,key){
  const [cx,cz]=key.split(',').map(Number);
  let hash=land.seed>>>0;for(const c of key)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  const kind=['animal','plant','treasure'][hash%3];
  let x=cx*LAND_RULES.chunkSize+2+((hash>>>3)%4);
  if(x>=3&&x<=5)x=1;
  const z=cz*LAND_RULES.chunkSize+2+((hash>>>7)%4);
  const rewards=kind==='animal'?{branch:2,wood:1}:kind==='plant'?{soil:2,water:1}:
    [{plank:4},{ramp:1},{workbench:1},{chest:1}][(hash>>>11)%4];
  return {id:`encounter-${key}`,kind,x,z,rewards,name:kind==='animal'?'小兔与物资包':kind==='plant'?'草地观察与物资包':'发现的宝箱'};
}
export const landEncounters=land=>land.opened.map(key=>encounterForChunk(land,key));
const cache=new WeakMap();
export function openChunks(land){
  const old=land&&cache.get(land);if(old&&old.count===land.opened.length)return old.keys;
  const keys=new Set(land?.opened||[]);
  for(let x=coreMin;x<=coreMax;x++)for(let z=coreMin;z<=coreMax;z++)keys.add(chunkKey(x,z));
  for(const key of FACILITY_CHUNKS)keys.add(key);
  if(land)cache.set(land,{count:land.opened.length,keys});return keys;
}
export function isGridOpen(land,x,z){
  return Number.isInteger(x)&&Number.isInteger(z)&&openChunks(land).has(chunkKey(Math.floor(x/LAND_RULES.chunkSize),Math.floor(z/LAND_RULES.chunkSize)));
}
export function isPointOpen(land,x,z,margin=0){
  if(!Number.isFinite(x)||!Number.isFinite(z))return false;
  return [-margin,margin].every(dx=>[-margin,margin].every(dz=>openChunks(land).has(chunkKey(Math.floor((x+dx)/LAND_RULES.chunkSize),Math.floor((z+dz)/LAND_RULES.chunkSize)))));
}
export function frontierChunks(land){
  const keys=openChunks(land),result=new Map();
  for(const key of keys){const [x,z]=key.split(',').map(Number);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const cx=x+dx,cz=z+dz,id=chunkKey(cx,cz);if(validChunk(cx,cz)&&!keys.has(id))result.set(id,{cx,cz,id});
  }}
  return [...result.values()];
}
export function nearbyFrontiers(land,player){
  if(!player||!isPointOpen(land,player.x,player.z))return [];
  const s=LAND_RULES.chunkSize,sx=Math.floor(player.x/s),sz=Math.floor(player.z/s),keys=openChunks(land),result=[];
  for(const [dx,dz,direction] of [[1,0,'东边'],[-1,0,'西边'],[0,1,'南边'],[0,-1,'北边']]){
    const cx=sx+dx,cz=sz+dz,id=chunkKey(cx,cz);
    if(!validChunk(cx,cz)||keys.has(id))continue;
    const x=dx?(sx+(dx>0?1:0))*s:player.x,z=dz?(sz+(dz>0?1:0))*s:player.z;
    const distance=Math.hypot(x-player.x,z-player.z);
    if(distance<=LAND_RULES.reclaimReach)result.push({cx,cz,id,direction,distance,edge:{x,z,dx,dz}});
  }
  return result.sort((a,b)=>a.distance-b.distance);
}
export function validateLand(value){
  if(!value||!Number.isSafeInteger(value.seed)||value.seed<1||value.seed>2147483647||!Array.isArray(value.opened)||value.opened.length>LAND_RULES.maxNewChunks)throw new Error('存档中的地图区块不正确。');
  const pending=new Set();
  for(const key of value.opened){
    if(typeof key!=='string')throw new Error('地图区块编号不正确。');
    const [x,z]=key.split(',').map(Number);
    if(isFacilityChunk(x,z))continue;
    if(!validChunk(x,z)||core(x,z)||chunkKey(x,z)!==key||pending.has(key))throw new Error('地图区块重复或越界。');
    pending.add(key);
  }
  const land={seed:value.seed,opened:[],claimed:[]};
  while(pending.size){
    const reachable=frontierChunks(land).filter(p=>pending.has(p.id));
    if(!reachable.length)throw new Error('新区需要与原河谷连接。');
    for(const p of reachable){land.opened.push(p.id);pending.delete(p.id);}
  }
  const claimed=value.claimed??[],ids=new Set(landEncounters(land).map(e=>e.id));
  if(!Array.isArray(claimed)||claimed.length>land.opened.length||new Set(claimed).size!==claimed.length||claimed.some(id=>!ids.has(id)))throw new Error('新区发现记录不正确。');
  land.claimed=[...claimed];return land;
}
export function landBounds(land){
  const points=[...openChunks(land)].map(k=>k.split(',').map(Number)),s=LAND_RULES.chunkSize;
  return {minX:Math.min(...points.map(p=>p[0]))*s,maxX:(Math.max(...points.map(p=>p[0]))+1)*s,
    minZ:Math.min(...points.map(p=>p[1]))*s,maxZ:(Math.max(...points.map(p=>p[1]))+1)*s};
}
