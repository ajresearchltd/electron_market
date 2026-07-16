import 'server-only';
import nodemailer from 'nodemailer';
import type {Attachment} from 'nodemailer/lib/mailer';

const bool=(value:string|undefined)=>['1','true','yes','on'].includes(String(value||'').trim().toLowerCase());
export function smtpConfigured(){return ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASSWORD','SMTP_FROM_EMAIL','SMTP_FROM_NAME','APP_BASE_URL'].every(name=>Boolean(process.env[name]?.trim()))}
export function invoiceAutoSendEnabled(){return bool(process.env.INVOICE_AUTO_SEND)}
function config(){if(!smtpConfigured())throw new Error('Electron Market SMTP server is not fully configured.');const port=Number(process.env.SMTP_PORT);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Electron Market SMTP server is not fully configured.');return {port,secure:bool(process.env.SMTP_SECURE)}}
export function smtpTransport(){const {port,secure}=config();return nodemailer.createTransport({host:process.env.SMTP_HOST!,port,secure,auth:{user:process.env.SMTP_USER!,pass:process.env.SMTP_PASSWORD!},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000})}
export async function verifySmtp(){await smtpTransport().verify();return true}
export async function sendSmtp(message:{to:string;subject:string;html:string;text:string;attachments?:Attachment[]}){const transport=smtpTransport();const result=await transport.sendMail({from:{name:process.env.SMTP_FROM_NAME!,address:process.env.SMTP_FROM_EMAIL!},replyTo:process.env.SMTP_REPLY_TO||undefined,...message});return {messageId:String(result.messageId||'')||null,accepted:Array.isArray(result.accepted)?result.accepted.map(String):[]}}
export function safeMailError(error:unknown){const value=error as {code?:string;command?:string};return {code:value?.code||'smtp_error',command:value?.command||null,message:'Test Invoice email could not be delivered. The Invoice remains available.'}}
