const nodemailer = require('nodemailer');

function assertEmailConfigured() {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    const error = new Error(`Email delivery is not configured (${missing.join(', ')}).`);
    error.statusCode = 503;
    throw error;
  }
}

async function sendInitialPassword({ email, name, password }) {
  assertEmailConfigured();
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Your LPG Delivery System account',
    text: `Hello ${name || 'User'},\n\nYour temporary password is: ${password}\n\nSign in and change it immediately. Do not share this password.`,
    html: `<p>Hello ${name || 'User'},</p><p>Your temporary password is:</p><p><strong>${password}</strong></p><p>Sign in and change it immediately. Do not share this password.</p>`
  });
}

async function verifyEmailTransport() {
  assertEmailConfigured();
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.verify();
}

module.exports = { assertEmailConfigured, sendInitialPassword, verifyEmailTransport };
