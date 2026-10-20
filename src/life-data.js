import { inPoolReservedArea } from './water-data.js';

export const LIFE_RULES=Object.freeze({
  daySeconds:240,seasonDays:3,maxElapsed:1000000000,
  startHour:6,dayStartHour:5,duskStartHour:18,nightStartHour:23,
  flowerCycle:240,budAt:60,flowerAt:100,seedAt:180,
  seasons:['春','夏','秋','冬'],periods:['早上','中午','下午','晚上','深夜'],
});
export const SPECIES=Object.freeze({
  dandelion:{name:'蒲公英',description:'多年生草本，先长叶丛，再形成花序和种子头。此处用温带季节示意，冷季保留根和叶，不计算离线枯死。',source:'https://www.rhs.org.uk/plants/232327/taraxacum-officinale/details'},
  bean:{name:'菜豆',description:'菜园保留固定适宜光照与照料的简化条件；水分和排水影响成长。不表示冬季普通露地也能这样种。'},
});
const seeded=(x,z)=>{const s=Math.sin(x*127.1+z*311.7)*43758.5453;return s-Math.floor(s);};
export const FLORA_SITES=[];
const occupied=new Set();
for(let i=0;i<66;i++){
  const x=Math.round(-15+seeded(i,11)*30),z=Math.round(-15+seeded(i,12)*30);
  if((x>2&&x<6)||(Math.abs(z-5)<3&&x>-8&&x<0)||(z>-7&&z<8&&x>-13&&x<12)||occupied.has(`${x},${z}`))continue;
  occupied.add(`${x},${z}`);FLORA_SITES.push(Object.freeze({id:`flora-${i+1}`,x,z,species:'dandelion',shade:FLORA_SITES.length%3===2}));
}
Object.freeze(FLORA_SITES);
export const createFlora=()=>FLORA_SITES.map(p=>({id:p.id,species:p.species,age:0}));
export const FLORA_BY_ID=Object.freeze(Object.fromEntries(FLORA_SITES.map(p=>[p.id,p])));
export const floraBlocked=(site,blocks)=>blocks.some(b=>b.x===site.x&&b.z===site.z)||
  (inPoolReservedArea(site.x,site.z)&&!blocks.some(b=>inPoolReservedArea(b.x,b.z,.5)));
export function clockInfo(clock){
  const elapsed=clock.elapsed,dayIndex=Math.floor(elapsed/LIFE_RULES.daySeconds);
  const seasonIndex=Math.floor(dayIndex/LIFE_RULES.seasonDays)%4;
  const phase=(elapsed%LIFE_RULES.daySeconds)/LIFE_RULES.daySeconds;
  const hands=clockHands(elapsed);
  return {day:dayIndex+1,seasonIndex,season:LIFE_RULES.seasons[seasonIndex],warm:seasonIndex<2,
    phase,period:dayPart(hands.hour,hands.minute)};
}
export function dayPart(hour,minute=0){
  const m=((hour%24)+24)%24*60+Math.min(59,Math.max(0,minute));
  if(m>=23*60||m<5*60)return '深夜';
  if(m<11*60)return '早上';
  if(m<13*60)return '中午';
  if(m<18*60)return '下午';
  return '晚上';
}
const DAYLIGHT=new Set(['早上','中午','下午']);
const WEATHER_BY_SEASON=[['sun','cloud','rain','wind'],['sun','sun','cloud','storm'],['sun','wind','cloud','fog'],['snow','cloud','snow','fog']];
const WEATHER_LABELS={sun:'晴',cloud:'多云',rain:'小雨',storm:'雷雨',wind:'有风',snow:'下雪',fog:'有雾'};
export function seasonIndexForMonth(month){
  if(month===11||month<=1)return 3;
  if(month<=4)return 0;
  if(month<=7)return 1;
  return 2;
}
export function weatherKind(date,seasonIndex=seasonIndexForMonth(date.getMonth())){
  const key=date.getFullYear()*372+date.getMonth()*31+date.getDate();
  return WEATHER_BY_SEASON[seasonIndex][key%4];
}
export function realMoment(date=new Date()){
  const seasonIndex=seasonIndexForMonth(date.getMonth());
  const hour=date.getHours(),minute=date.getMinutes();
  const minutes=hour*60+minute+date.getSeconds()/60;
  const kind=weatherKind(date,seasonIndex);
  return {seasonIndex,season:LIFE_RULES.seasons[seasonIndex],warm:seasonIndex<2,hour,minute,
    hourAngle:(minutes/60%12)*30,minuteAngle:(minutes%60)*6,
    period:dayPart(hour,minute),
    weather:{kind,label:WEATHER_LABELS[kind]},dateLabel:`${date.getMonth()+1}月${date.getDate()}日`};
}
const SKY_BY_SEASON=[
  {day:'#d5ead6',dusk:'#f0d2b4',night:'#b7c9d4'},
  {day:'#c9e4f4',dusk:'#f3c9a4',night:'#8eabcb'},
  {day:'#f3e2c4',dusk:'#e7b089',night:'#c3b4ae'},
  {day:'#e7eef3',dusk:'#d5d0dc',night:'#9aabbc'},
];
const GRASS_BY_SEASON=['#8fb86a','#7eb85a','#c4a15a','#d7ddd4'];
const SKY_KEYS=[
  {at:0,sky:'#1a2740',sun:.28,amb:.42,elev:-.22,sunColor:'#b7c6e4'},
  {at:5*60,sky:'#f4c99a',sun:1.25,amb:1.15,elev:.12,sunColor:'#ffc891'},
  {at:8*60,sky:'#d7ead8',sun:2.15,amb:1.8,elev:.55,sunColor:'#fff1d4'},
  {at:11*60,sky:'#c5e3f6',sun:2.75,amb:2.15,elev:.95,sunColor:'#fff8ea'},
  {at:13*60,sky:'#d5ead4',sun:2.5,amb:2.0,elev:.78,sunColor:'#fff3dc'},
  {at:16*60,sky:'#f0d2a4',sun:1.95,amb:1.7,elev:.4,sunColor:'#ffd0a0'},
  {at:18*60,sky:'#e59274',sun:.95,amb:1.1,elev:.06,sunColor:'#ffb089'},
  {at:20*60,sky:'#6d7ea0',sun:.42,amb:.72,elev:-.08,sunColor:'#d5def0'},
  {at:23*60,sky:'#243044',sun:.24,amb:.46,elev:-.2,sunColor:'#b7c6e4'},
  {at:24*60,sky:'#1a2740',sun:.28,amb:.42,elev:-.22,sunColor:'#b7c6e4'},
];
function mixHex(a,b,t){
  const pa=parseInt(a.slice(1),16),pb=parseInt(b.slice(1),16);
  const ch=(s,d)=>Math.round(s+(d-s)*t);
  const r=ch(pa>>16,pb>>16),g=ch((pa>>8)&255,(pb>>8)&255),bl=ch(pa&255,pb&255);
  return `#${[r,g,bl].map(v=>v.toString(16).padStart(2,'0')).join('')}`;
}
function sampleSky(minutes){
  const m=((minutes%1440)+1440)%1440;
  let i=0;
  while(i<SKY_KEYS.length-2&&m>=SKY_KEYS[i+1].at)i++;
  const a=SKY_KEYS[i],b=SKY_KEYS[i+1],t=Math.min(1,Math.max(0,(m-a.at)/(b.at-a.at||1)));
  return {sky:mixHex(a.sky,b.sky,t),sun:a.sun+(b.sun-a.sun)*t,amb:a.amb+(b.amb-a.amb)*t,elev:a.elev+(b.elev-a.elev)*t,sunColor:mixHex(a.sunColor,b.sunColor,t)};
}
export function skyLook(moment){
  const minutes=moment.hour*60+moment.minute;
  const sample=sampleSky(minutes);
  const season=SKY_BY_SEASON[moment.seasonIndex];
  const seasonSky=sample.elev<.08?season.night:sample.elev<.28?season.dusk:season.day;
  const dim={sun:1,cloud:.92,rain:.78,storm:.62,wind:.96,snow:.9,fog:.84}[moment.weather.kind]??1;
  const angle=(minutes/60-6)/12*Math.PI;
  return {sky:mixHex(sample.sky,seasonSky,.32),grass:GRASS_BY_SEASON[moment.seasonIndex],
    sun:sample.sun*dim,skyLight:sample.amb*(.85+.15*dim),sunColor:sample.sunColor,
    ground:mixHex(GRASS_BY_SEASON[moment.seasonIndex],'#3d4654',sample.elev<.15?.5:.12),
    sunX:Math.cos(angle)*-18,sunY:sample.elev>0?6+sample.elev*22:10,sunZ:Math.sin(angle)*10,
    fogNear:moment.weather.kind==='fog'?10:moment.weather.kind==='storm'?18:sample.elev<.1?28:42,
    fogFar:moment.weather.kind==='fog'?36:moment.weather.kind==='storm'?58:sample.elev<.1?62:86};
}
export function floraStage(plant,clock,date=new Date()){
  const info=realMoment(date);
  if(!info.warm)return info.seasonIndex===3?'rest':'leaf';
  if(plant.age>=LIFE_RULES.seedAt)return 'seed';
  if(plant.age>=LIFE_RULES.flowerAt)return DAYLIGHT.has(info.period)?'flower':'closed';
  return plant.age>=LIFE_RULES.budAt?'bud':'leaf';
}
export const FLORA_LABELS=Object.freeze({leaf:'叶丛',bud:'花苞',flower:'开花',closed:'花序合拢',seed:'种子头',rest:'冷季休眠'});
export function clockHands(elapsed){
  const minutes=LIFE_RULES.startHour*60+elapsed/LIFE_RULES.daySeconds*1440;
  return {hour:Math.floor(minutes/60)%24,minute:Math.floor(minutes)%60,
    hourAngle:(minutes/60%12)*30,minuteAngle:(minutes%60)*6};
}
