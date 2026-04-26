const cron = require('node-cron');
const prisma = require('../config/db');

cron.schedule('0 * * * *', async () => {
    console.log('Running payment expiry check...');
    try {
        const now = new Date();
        const expiredBookings = await prisma.booking.findMany({
            where: { status: 'ACCEPTED', payment_status: 'UNPAID', payment_deadline: { lt: now } }
        });

        for (const booking of expiredBookings) {
            await prisma.booking.update({
                where: { id: booking.id },
                data: { status: 'VOIDED' }
            });
        }
    } catch (error) {
        console.error('Cron Job Failed:', error);
    }
});