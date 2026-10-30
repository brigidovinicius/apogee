"use server";
import {headers} from "next/headers";
import {notFound,redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {getCurrentMember} from "@/lib/members/dal";
import {getAuth} from "@/lib/members/auth";
import {applicationOrigin} from "@/lib/members/mail";
import {consumeRateLimit} from "@/lib/members/rate-limit";
import {getSql} from "@/lib/members/db";
import {requestAdultReview,requestDependent,revokeDependent,supervisedRegistrationEnabled} from "@/lib/members/protection";

async function perform(operation:(id:string)=>Promise<unknown>) {
  if(!supervisedRegistrationEnabled())notFound();
  const member=await getCurrentMember();if(!member)redirect('/membros/entrar');
  let result='ok';
  try {
    if(!(await consumeRateLimit('protection:'+member.id,6,60)))throw Error('Rate limited');
    await operation(member.id);
  }catch{result='erro';}
  revalidatePath('/membros/protecao');revalidatePath('/admin/protecao');
  redirect('/membros/protecao?resultado='+result);
}
export async function requestAdultAction(form:FormData) {
  await perform(id=>requestAdultReview(id,form.get('adultDeclared')==='on'));
}
export async function requestDependentAction(form:FormData) {
  await perform(id=>requestDependent(id,{nickname:String(form.get('nickname')??''),ageBand:String(form.get('ageBand')??''),relationship:String(form.get('relationship')??''),consent:form.get('consent')==='on'}));
}
export async function revokeDependentAction(form:FormData) {
  await perform(id=>revokeDependent(id,String(form.get('dependentId')??'')));
}
export async function sendProtectionVerificationAction() {
  await perform(async id=>{
    const [user]=await getSql()`select email from "user" where id=${id}`;
    if(!user)throw Error('Account missing');
    await getAuth().api.sendVerificationEmail({headers:await headers(),body:{email:String(user.email),callbackURL:applicationOrigin()+'/membros/protecao'}});
  });
}
