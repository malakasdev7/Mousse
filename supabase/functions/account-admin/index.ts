import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const reply = (data: unknown, status=200) => new Response(JSON.stringify(data),{status,headers});
Deno.serve(async request => {
 if(request.method!=='POST') return reply({error:'Método inválido.'},405);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
 const {data:auth,error:authError}=await admin.auth.getUser(token);
 if(authError||!auth.user) return reply({error:'Sessão inválida.'},401);
 const body=await request.json().catch(()=>null);
 if(!body) return reply({error:'Requisição inválida.'},400);
 const query=admin.from('store_members').select('store_id,role').eq('user_id',auth.user.id).eq('role','admin');
 if(body.storeId) query.eq('store_id',body.storeId);
 const {data:member}=await query.limit(1).maybeSingle();
 if(!member) return reply({error:'Acesso negado.'},403);
 const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
 const password=typeof body.password==='string'?body.password:'';
 if(!/^[a-z0-9._-]{3,32}$/.test(username)||password.length<10||password.length>128) return reply({error:'Revise o usuário e a senha (mínimo 10 caracteres).'},422);
 if(body.action==='reset-password'){
  const {data:profile}=await admin.from('profiles').select('user_id').eq('username_normalized',username).maybeSingle();
  const {data:target}=profile?await admin.from('store_members').select('user_id').eq('store_id',member.store_id).eq('user_id',profile.user_id).maybeSingle():{data:null};
  if(!target) return reply({error:'Não foi possível redefinir este acesso.'},422);
  const {error}=await admin.auth.admin.updateUserById(target.user_id,{password});
  if(error) return reply({error:'Não foi possível redefinir este acesso.'},422);
  return reply({ok:true});
 }
 if(body.action!=='create') return reply({error:'Ação inválida.'},422);
 const displayName=typeof body.displayName==='string'?body.displayName.trim():'';
 if(!displayName||displayName.length>100||!['admin','employee','viewer'].includes(body.role)) return reply({error:'Revise nome e permissão.'},422);
 const internalEmail=username+'.'+crypto.randomUUID()+'@users.doce-margem.invalid';
 const {data:created,error}=await admin.auth.admin.createUser({email:internalEmail,password,email_confirm:true});
 if(error||!created.user) return reply({error:'Não foi possível criar a conta.'},422);
 try{
  await admin.from('profiles').insert({user_id:created.user.id,username,internal_email:internalEmail,display_name:displayName}).throwOnError();
  await admin.from('store_members').insert({store_id:member.store_id,user_id:created.user.id,role:body.role,created_by:auth.user.id}).throwOnError();
  return reply({ok:true},201);
 }catch{
  await admin.auth.admin.deleteUser(created.user.id);
  return reply({error:'Não foi possível criar a conta. Confira os dados e tente novamente.'},422);
 }
});
