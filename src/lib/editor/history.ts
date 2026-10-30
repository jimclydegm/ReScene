export type EditHistory<T>={past:T[];present:T;future:T[];group:string|null;groupFuture?:T[];groupPast?:T[]};
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function editHistory<T>(present:T):EditHistory<T>{return {past:[],present,future:[],group:null};}
export function finishEdit<T>(state:EditHistory<T>):EditHistory<T>{
 if(state.group===null)return state;
 const noChange=state.past.length>0&&equal(state.past.at(-1),state.present);
 return {...state,past:noChange?state.groupPast??state.past.slice(0,-1):state.past,future:noChange?state.groupFuture??[]:state.future,group:null,groupFuture:undefined,groupPast:undefined};
}
export function recordEdit<T>(state:EditHistory<T>,present:T,group:string|null=null):EditHistory<T>{
 if(equal(state.present,present))return state;
 const base=state.group===group?state:finishEdit(state),same=group!==null&&base.group===group;
 return {past:same?base.past:[...base.past.slice(-49),base.present],present,future:[],group,groupFuture:same?base.groupFuture:group!==null?base.future:undefined,groupPast:same?base.groupPast:group!==null?base.past:undefined};
}
export function undoEdit<T>(state:EditHistory<T>):EditHistory<T>{
 const s=finishEdit(state);if(!s.past.length)return s;
 return {past:s.past.slice(0,-1),present:s.past.at(-1)!,future:[...s.future,s.present],group:null};
}
export function redoEdit<T>(state:EditHistory<T>):EditHistory<T>{
 const s=finishEdit(state);if(!s.future.length)return s;
 return {past:[...s.past.slice(-49),s.present],present:s.future.at(-1)!,future:s.future.slice(0,-1),group:null};
}
