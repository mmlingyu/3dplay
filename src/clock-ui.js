import { clockHands, realMoment } from './life-data.js';

function drawClock(time,size,label){
  const numbers=Array.from({length:12},(_,i)=>{
    const n=i+1,a=n*Math.PI/6;
    return `<text x="${32+Math.sin(a)*23}" y="${34.5-Math.cos(a)*23}" text-anchor="middle" fill="#426b58" font-size="7.5" font-weight="700">${n}</text>`;
  }).join('');
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="${label}"><circle cx="32" cy="32" r="30" fill="#fff5db" stroke="#789957" stroke-width="2"/>${numbers}<line data-clock-hand="hour" x1="32" y1="32" x2="32" y2="19" stroke="#426b58" stroke-width="3.5" stroke-linecap="round" transform="rotate(${time.hourAngle} 32 32)"/><line data-clock-hand="minute" x1="32" y1="32" x2="32" y2="11" stroke="#bc8165" stroke-width="2" stroke-linecap="round" transform="rotate(${time.minuteAngle} 32 32)"/><circle cx="32" cy="32" r="2.5" fill="#426b58"/></svg>`;
}
export function analogClock(elapsed,size=64){
  const time=clockHands(elapsed);
  return drawClock(time,size,`游戏时钟 ${time.hour}点${time.minute}分，短时针、长分针`);
}
export function realAnalogClock(size=64,date=new Date()){
  const time=realMoment(date);
  const minute=String(time.minute).padStart(2,'0');
  return drawClock(time,size,`现在${time.period} ${time.hour}点${minute}分，${time.season}，${time.weather.label}`);
}
