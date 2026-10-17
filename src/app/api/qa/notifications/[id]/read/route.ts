import { NextResponse } from 'next/server'
import {fetchQaApi} from '@/lib/auth/qa-api'

export async function PATCH(_: Request,{params}:{params:{id:string}}) {
  if(!/^[1-9]\d*$/.test(params.id)) return NextResponse.json({error:'Invalid notification ID.'},{status:400})
  const response=await fetchQaApi(`/api/dashboard/v1/Notification/${params.id}/read`,{method:'PATCH'})
  return new NextResponse(await response.text(),{status:response.status,headers:{'content-type':'application/json','cache-control':'no-store'}})
}
