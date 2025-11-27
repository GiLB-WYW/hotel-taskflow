// Resend email integration for sending invitations
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

export async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export async function sendInvitationEmail(
  toEmail: string, 
  toName: string, 
  inviteToken: string,
  inviterName: string,
  role: string
) {
  const { client, fromEmail } = await getResendClient();
  
  const baseUrl = process.env.REPLIT_DEPLOYMENT_URL 
    ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
    : process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'http://localhost:5000';
  
  const inviteUrl = `${baseUrl}/accept-invite?token=${inviteToken}`;
  
  const { data, error } = await client.emails.send({
    from: fromEmail || 'Hôtel TaskFlow <noreply@resend.dev>',
    to: [toEmail],
    subject: `You're invited to join Hôtel TaskFlow`,
    html: `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #c9a962;">
          <h1 style="color: #1e3a5f; margin: 0; font-size: 28px;">Toile Blanche L'Hôtel</h1>
          <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">Hôtel TaskFlow</p>
        </div>
        
        <div style="padding: 30px 0;">
          <h2 style="color: #1e3a5f;">Hello ${toName},</h2>
          
          <p style="color: #333; line-height: 1.6;">
            ${inviterName} has invited you to join the Hôtel TaskFlow maintenance management system as a <strong>${role}</strong>.
          </p>
          
          <p style="color: #333; line-height: 1.6;">
            Click the button below to create your account and set your password:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" 
               style="background-color: #1e3a5f; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 8px; font-weight: bold;
                      display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <p style="color: #666; font-size: 12px;">
            This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
          </p>
          
          <p style="color: #666; font-size: 12px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${inviteUrl}" style="color: #c9a962;">${inviteUrl}</a>
          </p>
        </div>
        
        <div style="border-top: 1px solid #ddd; padding-top: 20px; text-align: center;">
          <p style="color: #999; font-size: 12px; margin: 0;">
            Toile Blanche L'Hôtel - Hôtel TaskFlow<br>
            Maintenance Management System
          </p>
        </div>
      </div>
    `
  });

  if (error) {
    console.error('Failed to send invitation email:', error);
    throw new Error('Failed to send invitation email');
  }

  return data;
}

export async function sendPasswordResetEmail(
  toEmail: string,
  toName: string,
  resetToken: string
) {
  const { client, fromEmail } = await getResendClient();
  
  const baseUrl = process.env.REPLIT_DEPLOYMENT_URL 
    ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
    : process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'http://localhost:5000';
  
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  
  const { data, error } = await client.emails.send({
    from: fromEmail || 'Hôtel TaskFlow <noreply@resend.dev>',
    to: [toEmail],
    subject: `Reset your Hôtel TaskFlow password`,
    html: `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #c9a962;">
          <h1 style="color: #1e3a5f; margin: 0; font-size: 28px;">Toile Blanche L'Hôtel</h1>
          <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">Hôtel TaskFlow</p>
        </div>
        
        <div style="padding: 30px 0;">
          <h2 style="color: #1e3a5f;">Hello ${toName},</h2>
          
          <p style="color: #333; line-height: 1.6;">
            We received a request to reset your password. Click the button below to set a new password:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #1e3a5f; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 8px; font-weight: bold;
                      display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #666; font-size: 12px;">
            This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
          </p>
          
          <p style="color: #666; font-size: 12px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${resetUrl}" style="color: #c9a962;">${resetUrl}</a>
          </p>
        </div>
        
        <div style="border-top: 1px solid #ddd; padding-top: 20px; text-align: center;">
          <p style="color: #999; font-size: 12px; margin: 0;">
            Toile Blanche L'Hôtel - Hôtel TaskFlow<br>
            Maintenance Management System
          </p>
        </div>
      </div>
    `
  });

  if (error) {
    console.error('Failed to send password reset email:', error);
    throw new Error('Failed to send password reset email');
  }

  return data;
}
