import { z } from 'zod';
import { pgBigintId } from './quoteSemantics';
const id = z.union([z.string(),z.number()]).transform(pgBigintId).refine((v): v is string => v !== null, 'Geçersiz kayıt kimliği');
const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(200);
const channel = z.enum(['phone','whatsapp']);
const note = z.string().max(4000).optional();
const project = { projectId: uuid };
const contact = { ...project, channel, quoteId: id.optional(), taskId: uuid.optional(), note, occurredAt: z.string().datetime({offset:true}).optional() };
export const officeOperationSchema = z.discriminatedUnion('type', [
  z.object({type:z.literal('project_created'),quoteId:id,name:text,owner:text}).strict(),
  z.object({type:z.literal('project_linked'),...project,quoteId:id}).strict(),
  z.object({type:z.literal('valuation_selected'),...project,quoteId:id,revision:z.number().int().min(0)}).strict(),
  z.object({type:z.literal('valuation_cleared'),...project}).strict(),
  z.object({type:z.literal('contact_success'),...contact}).strict(),
  z.object({type:z.literal('contact_attempt'),...contact}).strict(),
  z.object({type:z.literal('contact_link_clicked'),...project,channel}).strict(),
  z.object({type:z.literal('phone_number_copied'),...project}).strict(),
  z.object({type:z.literal('followup_scheduled'),...project,dueAt:z.string().datetime({offset:true}),owner:text}).strict(),
  z.object({type:z.literal('task_cancelled'),...project,taskId:uuid,reason:text}).strict(),
  z.object({type:z.literal('outcome_recorded'),...project,status:z.enum(['pending','contacted','quoted','approved','completed','rejected']),lossCategory:z.enum(['fiyat','stok_termin','vade_odeme','ulasilamadi','rakip','vazgecti','diger']).optional(),reason:note}).strict(),
]);
export type OfficeOperationInput = z.input<typeof officeOperationSchema>;
