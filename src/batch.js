// Bounded fan-out: multiple QQ groups run in parallel, but each group
// processes its own operations sequentially so a multipart relay keeps order.
// OneBot itself has no guaranteed broadcast/multi-group send API.
export async function fanoutByGroup(items,handler,{concurrency=4,key=item=>item.target_group}={}){
 const queues=new Map();
 for(const item of items){
  const group=String(key(item));
  if(!queues.has(group))queues.set(group,[]);
  queues.get(group).push(item);
 }
 const groups=[...queues.values()];
 let cursor=0;
 const threads=Math.min(Math.max(1,Math.floor(Number(concurrency)||1)),8,groups.length);
 const workers=Array.from({length:threads},async()=>{
  while(cursor<groups.length){
   const batch=groups[cursor++];
   for(const item of batch)await handler(item);
  }
 });
 await Promise.all(workers);
 return {groups:groups.length,items:items.length,parallel:threads};
}
