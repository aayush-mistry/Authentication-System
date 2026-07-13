const nodemailer = require('nodemailer');

// We will use Ethereal Email for testing. It's a fake SMTP service 
// that catches outgoing emails so we can view them in the browser.
// In a real app, you would use SendGrid, Mailgun, or standard Gmail SMTP.

const sendEmail = async (options) => {
  try {
    // Automatically create a test account on Ethereal
    let testAccount = await nodemailer.createTestAccount();

    // Create a reusable transporter object
    let transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user, // generated ethereal user
        pass: testAccount.pass, // generated ethereal password
      },
    });

    // Send mail with defined transport object
    let info = await transporter.sendMail({
      from: '"Auth System" <noreply@authsystem.com>',
      to: options.email,
      subject: options.subject,
      text: options.message,
      // You can also add HTML if needed
    });

    console.log("Message sent: %s", info.messageId);
    // Ethereal gives us a URL to preview the email since it doesn't really send it
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    
    return nodemailer.getTestMessageUrl(info);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error('Email could not be sent');
  }
};

module.exports = sendEmail;
