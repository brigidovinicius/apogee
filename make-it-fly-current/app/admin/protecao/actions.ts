"use server";
import {notFound,redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {requireAdmin} from "@/lib/members/dal";
import {reviewProtection,supervisedRegistrationEnabled} from "@/lib/members/protection";
export async function reviewProtectionAction(form:FormData) {
  if(!supervisedRegistrationEnabled())notFound();
  const actor=await requireAdmin('/admin/protecao');let result='ok';
  try {
    if(!['aprovar','rejeitar'].includes(String(form.get('decision'))))throw Error('Invalid decision');
    await reviewProtection(actor.id,String(form.get('kind')),String(form.get('subjectId')),form.get('decision')==='aprovar',String(form.get('reference')??''),form.get('checks')==='on');
  }catch{result='erro';}
  revalidatePath('/admin/protecao');revalidatePath('/membros/protecao');redirect('/admin/protecao?resultado='+result);
}
