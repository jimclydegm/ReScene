"use client";
export function requestNavigation(proceed:()=>void){
 const event=new CustomEvent("rescene:confirm-navigation",{cancelable:true,detail:{proceed}});
 if(window.dispatchEvent(event))proceed();
}
