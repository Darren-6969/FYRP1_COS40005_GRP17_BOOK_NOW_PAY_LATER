const nodemailer = require('nodemailer');

// Reuse the transporter so you don't open multiple connections
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

exports.sendSuggestionEmail = async (customerEmail, originalRoom, newRoom) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: customerEmail,
        subject: 'Update Regarding Your Booking Request',
        html: `
            <h2>Booking Update</h2>
            <p>Unfortunately, the <b>${originalRoom}</b> is currently unavailable.</p>
            <p>However, the operator has suggested an alternative: <b>${newRoom}</b>.</p>
            <p>Please log in to your dashboard to accept or reject this new offer.</p>
        `,
    };
    return transporter.sendMail(mailOptions).catch(err => console.error("Email Error:", err));
};

exports.sendPaymentConfirmedEmail = async (customerEmail, bookingId) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: customerEmail,
        subject: 'Payment Confirmed - Booking Secured',
        html: `
            <h2>Payment Successful</h2>
            <p>Your payment for Booking ID <b>${bookingId}</b> has been verified.</p>
            <p>Your booking is now officially confirmed. Thank you!</p>
        `,
    };
    return transporter.sendMail(mailOptions).catch(err => console.error("Email Error:", err));
};