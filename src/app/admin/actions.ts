"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminRepository, type MatrixInput } from "@/data/admin-repository";

function entries(formData: FormData): MatrixInput[] {
  return [...formData.keys()].filter((key) => key.startsWith("selected:")).map((key) => {
    const competencyId = key.slice("selected:".length);
    return { competencyId, requiredLevel: Number(formData.get(`level:${competencyId}`)), importance: Number(formData.get(`importance:${competencyId}`)) };
  });
}
export async function createDraft(formData: FormData) { const roleId = String(formData.get("roleId")); new AdminRepository().createDraft(roleId); revalidatePath("/admin"); redirect(`/admin/matrices/${roleId}`); }
export async function saveMatrix(formData: FormData) { const roleId = String(formData.get("roleId")); new AdminRepository().saveDraft(String(formData.get("versionId")), entries(formData)); revalidatePath("/admin"); revalidatePath(`/admin/matrices/${roleId}`); }
export async function publishMatrix(formData: FormData) { const roleId = String(formData.get("roleId")); const repository = new AdminRepository(); repository.saveDraft(String(formData.get("versionId")), entries(formData)); await repository.publish(String(formData.get("versionId"))); revalidatePath("/admin"); revalidatePath(`/admin/matrices/${roleId}`); redirect(`/admin/matrices/${roleId}/preview`); }
