import nodemailer from 'nodemailer';
import { readFileSync } from 'node:fs';
import type { SmtpConfig } from '../config/schema.js';

const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50MB Kindle limit

export interface SendOptions {
  readonly smtpConfig: SmtpConfig;
  readonly fromEmail: string;
  readonly toEmails: string[];
  readonly epubPath: string;
  readonly bundleTitle: string;
}

export async function sendToKindle(options: SendOptions): Promise<void> {
  const fileBuffer = readFileSync(options.epubPath);

  if (fileBuffer.length > MAX_ATTACHMENT_SIZE) {
    throw new Error(
      `EPUB file is ${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB, ` +
        `exceeding Kindle's ${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB limit.`,
    );
  }

  const transporter = nodemailer.createTransport({
    host: options.smtpConfig.host,
    port: options.smtpConfig.port,
    secure: options.smtpConfig.secure,
    auth: {
      user: options.smtpConfig.user,
      pass: options.smtpConfig.pass,
    },
  });

  // Send one email with all Kindle addresses in TO so Amazon groups them as one document
  await transporter.sendMail({
    from: options.fromEmail,
    to: options.toEmails.join(', '),
    subject: options.bundleTitle,
    text: `Articles bundle: ${options.bundleTitle}`,
    attachments: [
      {
        filename: `${options.bundleTitle}.epub`,
        content: fileBuffer,
        contentType: 'application/epub+zip',
      },
    ],
  });
}
