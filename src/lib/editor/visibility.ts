export function subjectVisibility<T extends {id:string;assemblyRootId:string|null;modelUrl:string|null;visible:boolean}>(objects:T[],selected:string|null){
 const chosen=objects.find(o=>o.id===selected),root=chosen?.assemblyRootId??chosen?.id;
 if(selected!==null&&!root)return objects;
 return objects.map(o=>o.modelUrl?{...o,visible:selected===null||o.id===root||o.assemblyRootId===root}:o);
}
