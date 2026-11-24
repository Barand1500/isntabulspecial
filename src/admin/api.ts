export interface AdminSession {user:{email:string;name:string};sessionId:number;deviceId:number}
export interface Device {id:number;name:string;type:'desktop'|'mobile';ip:string;created:number;last_seen:number;method:string;current:boolean;active:boolean;trusted:boolean;detected_name:string;trusted_until:number}
export async function api<T>(url:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 const response=await fetch(url,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal});
 let data;try{data=await response.json();}catch{throw new Error('Sunucuya ulaşılamadı. Lütfen tekrar deneyin.');}
 if(!response.ok){const error=new Error(data.error || 'İşlem tamamlanamadı.') as Error&{status:number};error.status=response.status;throw error;}
 return data as T;
}
