import { ITEMS, RECIPES } from './game-data.js';

export class WorkshopSession {
  constructor(game,{large=false}={}){
    this.game=game;this.large=large;this.side=large?3:2;this.disposed=false;this.clear();
  }
  clear(){this.grid=Array.from({length:this.side},()=>Array(this.side).fill(null));this.selectedRecipe=null;}
  valid(x,y){return !this.disposed&&Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<this.side&&y<this.side;}
  reconcile(){
    const matches=this.game.getMatches(this.grid);
    if(!matches.some(r=>r.id===this.selectedRecipe))this.selectedRecipe=matches.length===1?matches[0].id:null;
    return matches;
  }
  put(x,y,item){
    if(!this.valid(x,y)||(item!==null&&!Object.hasOwn(ITEMS,item)))return false;
    this.grid[y][x]=item;this.reconcile();return true;
  }
  move(x,y,toX,toY){
    if(!this.valid(x,y)||!this.valid(toX,toY)||!this.grid[y][x])return false;
    const item=this.grid[y][x];this.grid[y][x]=this.grid[toY][toX];this.grid[toY][toX]=item;this.reconcile();return true;
  }
  resize(side){
    if(this.disposed||![2,3].includes(side)||(side===3&&!this.large))return false;
    this.side=side;this.clear();return true;
  }
  example(id){
    if(this.disposed)return false;
    const r=RECIPES.find(r=>r.id===id);
    if(!r||r.pattern.length>this.side||r.pattern.some(row=>row.length>this.side))return false;
    this.clear();r.pattern.forEach((row,y)=>row.forEach((item,x)=>{this.grid[y][x]=item;}));this.selectedRecipe=id;return true;
  }
  choose(id){
    if(this.disposed||!this.game.getMatches(this.grid).some(r=>r.id===id))return false;
    this.selectedRecipe=id;return true;
  }
  snapshot(){
    const matches=this.reconcile(),used={};
    for(const item of this.grid.flat())if(item)used[item]=(used[item]||0)+1;
    const missing=Object.keys(used).filter(item=>used[item]>this.game.state.inventory[item]);
    return {side:this.side,grid:this.grid.map(row=>[...row]),selectedRecipe:this.selectedRecipe,matches:matches.map(r=>r.id),
      missing,ready:!this.disposed&&!!this.selectedRecipe&&!missing.length};
  }
  craft(){
    if(this.disposed)return {ok:false,message:'工作台已经关闭，材料仍在背包里。'};
    this.reconcile();
    const result=this.game.craft(this.grid,this.selectedRecipe);
    if(result.ok)this.clear();
    return result;
  }
  dispose(){this.disposed=true;}
}
