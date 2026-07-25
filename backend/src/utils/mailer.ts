import nodemailer from 'nodemailer';

let cachedTransporter: nodemailer.Transporter | null = null;
let testAccount: any = null;
let modeLogged = false;
let etherealCreationFailed = false;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  // Ethereal is only for development
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Ethereal SMTP is not allowed in production');
  }

  if (etherealCreationFailed) {
    throw new Error('Ethereal fallback SMTP setup previously failed');
  }

  if (!testAccount) {
    try {
      testAccount = await nodemailer.createTestAccount();
    } catch (err: any) {
      etherealCreationFailed = true;
      console.error('Failed to create Ethereal test account:', err);
      throw new Error(`Ethereal creation failed: ${err.message}`);
    }
  }

  if (!modeLogged) {
    console.log('\n====================================================');
    console.log('📬 [MAILER CONFIG]: DEVELOPMENT ETHEREAL SMTP');
    console.log('====================================================\n');
    modeLogged = true;
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount?.user || 'ethereal_fallback_user',
      pass: testAccount?.pass || 'ethereal_fallback_pass',
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
  });

  cachedTransporter = transporter;
  return cachedTransporter;
}

/**
 * Core send mail helper routing between Resend API and Ethereal fallback.
 */
async function sendMailHelper(to: string, subject: string, html: string, flowName: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const isProd = process.env.NODE_ENV === 'production';

  // Check if Resend API Key is available
  if (apiKey) {
    const fromAddress = process.env.EMAIL_FROM;
    if (!fromAddress) {
      console.error('❌ [MAILER CONFIG ERROR]: EMAIL_FROM is required when using Resend API.');
      throw new Error(`Unable to send ${flowName} email. Configuration error.`);
    }

    if (!modeLogged) {
      console.log('\n====================================================');
      console.log('📬 [MAILER CONFIG]: RESEND HTTPS API');
      console.log(`📧 Sender (EMAIL_FROM): ${fromAddress}`);
      console.log('====================================================\n');
      modeLogged = true;
    }

    // Timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [to],
          subject,
          html,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const resBody = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error(
          `❌ [MAILER ERROR]: Resend API request failed. Status: ${response.status}. Error Details:`,
          JSON.stringify(resBody)
        );
        throw new Error('API delivery failed');
      }

      console.log(`📬 [MAILER SUCCESS]: Email successfully dispatched via Resend to ${to}`);
      return;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.error(`❌ [MAILER TIMEOUT]: Resend API request timed out after 5000ms`);
      } else {
        console.error(`❌ [MAILER ERROR]: Failed to send email via Resend API:`, err.message);
      }
      throw new Error(`Unable to send ${flowName} email. Please try again.`);
    }
  }

  // If in production but no RESEND_API_KEY is configured
  if (isProd) {
    console.error('❌ [MAILER CONFIG ERROR]: RESEND_API_KEY is missing in production environment');
    throw new Error(`Unable to send ${flowName} email. Configuration error.`);
  }

  // Development Fallback: Ethereal SMTP
  try {
    const transporter = await getTransporter();
    
    // Fallback Sender
    const fromAddress = process.env.EMAIL_FROM || '"GravityX Terminal" <no-reply@gravityx.play>';
    
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
    });

    if (testAccount) {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      // Find token and generate preview URL
      const matches = html.match(/token=([^"\s&]+)/);
      const token = matches ? matches[1] : '';
      const previewLink = flowName.includes('verification') 
        ? `${clientUrl}/auth?tab=verify&token=${token}`
        : `${clientUrl}/auth?tab=reset&token=${token}`;

      console.log('\n====================================================');
      console.log(`🌌 [DEVELOPMENT SMTP]: ${flowName} email dispatched via Ethereal.`);
      console.log(`🔗 Token Link: ${previewLink}`);
      console.log(`📬 View Ethereal Inbox Link: ${nodemailer.getTestMessageUrl(info)}`);
      console.log('====================================================\n');
    }
  } catch (err: any) {
    console.error('❌ [MAILER ERROR]: Failed to send Ethereal email:', err.message);
    throw new Error(`Unable to send ${flowName} email. Please try again.`);
  }
}

/**
 * Send Email Verification Token
 */
export async function sendVerificationEmail(email: string, token: string, username: string) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const verificationLink = `${clientUrl}/auth?tab=verify&token=${token}`;

  const subject = '🌌 GravityX - Verify Your Orbital Identity';
  const html = `
    <div style="background-color: #050816; color: #ffffff; padding: 30px; font-family: sans-serif; border-radius: 12px; max-width: 500px; margin: auto; border: 1px solid #6C63FF;">
      <h2 style="color: #00F5FF; text-align: center;">GRAVITYX</h2>
      <p style="font-size: 14px; color: #a0aec0;">Greetings, <strong>${username}</strong>.</p>
      <p style="font-size: 14px; color: #a0aec0; line-height: 1.5;">Welcome to the GravityX multiplayer matrix. Please confirm your email to authorize account telemetry sync.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" style="background-color: #6C63FF; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; border: 1px solid #00F5FF;">
          Authorize Identity
        </a>
      </div>
      
      <p style="font-size: 11px; color: #718096; text-align: center; margin-top: 20px;">If this wasn't you, please ignore this transmission.</p>
    </div>
  `;

  await sendMailHelper(email, subject, html, 'verification');
}

/**
 * Send Password Reset Token
 */
export async function sendResetPasswordEmail(email: string, token: string, username: string) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const resetLink = `${clientUrl}/auth?tab=reset&token=${token}`;

  const subject = '🔑 GravityX - Reset Credentials Request';
  const html = `
    <div style="background-color: #050816; color: #ffffff; padding: 30px; font-family: sans-serif; border-radius: 12px; max-width: 500px; margin: auto; border: 1px solid #FF4D4D;">
      <h2 style="color: #FF5EDF; text-align: center;">GRAVITYX</h2>
      <p style="font-size: 14px; color: #a0aec0;">Greetings, <strong>${username}</strong>.</p>
      <p style="font-size: 14px; color: #a0aec0; line-height: 1.5;">We received a request to override your credentials telemetry. Click the link below to verify.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #FF4D4D; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; border: 1px solid #FF5EDF;">
          Reset Credentials
        </a>
      </div>
      
      <p style="font-size: 11px; color: #718096; text-align: center; margin-top: 20px;">This override request token expires in 1 hour.</p>
    </div>
  `;

  await sendMailHelper(email, subject, html, 'password reset');
}
