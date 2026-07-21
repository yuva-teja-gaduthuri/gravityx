import nodemailer from 'nodemailer';

let testAccount: any = null;

/**
 * Dynamically resolves SMTP transporter.
 * If SMTP credentials exist in .env, it uses them.
 * Otherwise, it spins up a test Ethereal account (prints log links in development).
 */
async function getTransporter() {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Development Fallback: Ethereal dynamic test accounts
  if (!testAccount) {
    try {
      testAccount = await nodemailer.createTestAccount();
    } catch (err) {
      console.error('Failed to create Ethereal test account:', err);
    }
  }

  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount?.user || 'ethereal_fallback_user',
      pass: testAccount?.pass || 'ethereal_fallback_pass',
    },
  });
}

/**
 * Send Email Verification Token
 */
export async function sendVerificationEmail(email: string, token: string, username: string) {
  const transporter = await getTransporter();
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const verificationLink = `${clientUrl}/auth?tab=verify&token=${token}`;

  const mailOptions = {
    from: `"GravityX Terminal" <${process.env.SMTP_USER || 'no-reply@gravityx.play'}>`,
    to: email,
    subject: '🌌 GravityX - Verify Your Orbital Identity',
    html: `
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
    `,
  };

  const info = await transporter.sendMail(mailOptions);

  // If using Ethereal in development, print the view link to the server logs!
  if (testAccount && !process.env.SMTP_USER) {
    console.log('\n====================================================');
    console.log('🌌 [DEVELOPMENT SMTP]: Email verification link dispatched.');
    console.log(`🔗 Verification Link: ${verificationLink}`);
    console.log(`📬 View Ethereal Inbox Link: ${nodemailer.getTestMessageUrl(info)}`);
    console.log('====================================================\n');
  }
}

/**
 * Send Password Reset Token
 */
export async function sendResetPasswordEmail(email: string, token: string, username: string) {
  const transporter = await getTransporter();
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const resetLink = `${clientUrl}/auth?tab=reset&token=${token}`;

  const mailOptions = {
    from: `"GravityX Terminal" <${process.env.SMTP_USER || 'no-reply@gravityx.play'}>`,
    to: email,
    subject: '🔑 GravityX - Reset Credentials Request',
    html: `
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
    `,
  };

  const info = await transporter.sendMail(mailOptions);

  if (testAccount && !process.env.SMTP_USER) {
    console.log('\n====================================================');
    console.log('🔑 [DEVELOPMENT SMTP]: Reset password link dispatched.');
    console.log(`🔗 Reset Password Link: ${resetLink}`);
    console.log(`📬 View Ethereal Inbox Link: ${nodemailer.getTestMessageUrl(info)}`);
    console.log('====================================================\n');
  }
}
