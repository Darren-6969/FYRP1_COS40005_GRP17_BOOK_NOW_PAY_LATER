import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

// Master Pages
import MasterLayout from "./pages/master/layout/MasterLayout";
import Dashboard from "./pages/master/Dashboard";
import Bookings from "./pages/master/Bookings";
import Payments from "./pages/master/Payments";
import Receipts from "./pages/master/Receipts";
import Invoices from "./pages/master/Invoices";
import Operators from "./pages/master/Operators";
import SalesReport from "./pages/master/SalesReport";
import CronJobs from "./pages/master/CronJobs";
import SystemLogs from "./pages/master/SystemLogs";
import SystemSettings from "./pages/master/SystemSettings";
import ProtectedRoute from "./components/ProtectedRoute";
import EmailLogs from "./pages/master/EmailLogs";

// Customer Pages
import CustomerLayout from "./pages/customer/layout/CustomerLayout";
import MyBookings from "./pages/customer/MyBookings";
import BookingDetail from "./pages/customer/BookingDetail";
import Checkout from "./pages/customer/Checkout";
import PaymentStatus from "./pages/customer/PaymentStatus";
import UploadReceipt from "./pages/customer/UploadReceipt";
import CustomerPayments from "./pages/customer/CustomerPayments";
import CustomerInvoices from "./pages/customer/CustomerInvoices";
import CustomerNotifications from "./pages/customer/CustomerNotifications";
import CustomerProfile from "./pages/customer/CustomerProfile";
import CustomerInvoiceDetail from "./pages/customer/CustomerInvoiceDetail";
import CustomerHelp from "./pages/customer/CustomerHelp";


// Operator Pages
import OperatorLayout from "./pages/operator/layout/OperatorLayout";
import OperatorDashboard from "./pages/operator/OperatorDashboard";
import OperatorBookingRequests from "./pages/operator/OperatorBookingRequests";
import OperatorBookingDetail from "./pages/operator/OperatorBookingDetail";
import OperatorPaymentVerification from "./pages/operator/OperatorPaymentVerification";
import OperatorBookingLog from "./pages/operator/OperatorBookingLog";
import OperatorInvoices from "./pages/operator/OperatorInvoices";
import OperatorSalesReport from "./pages/operator/OperatorSalesReport";
import OperatorNotifications from "./pages/operator/OperatorNotifications";
import OperatorSettings from "./pages/operator/OperatorSettings";
import OperatorHelp from "./pages/operator/OperatorHelp";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* Protected Routes */}
          {/* Master Routes */}
          <Route element={<ProtectedRoute allowedRoles={["MASTER_SELLER"]} />}>
            <Route path="/master" element={<MasterLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="payments" element={<Payments />} />
              <Route path="receipts" element={<Receipts />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="operators" element={<Operators />} />
              <Route path="sales-report" element={<SalesReport />} />
              <Route path="cron-jobs" element={<CronJobs />} />
              <Route path="system-logs" element={<SystemLogs />} />
              <Route path="system-settings" element={<SystemSettings />} />
              <Route path="email-logs" element={<EmailLogs />} />
            </Route>
          </Route>

          {/* Operator Routes */}
          <Route element={<ProtectedRoute allowedRoles={["NORMAL_SELLER", "MASTER_SELLER"]} />}>
            <Route path="/operator" element={<OperatorLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<OperatorDashboard />} />
              <Route path="booking-requests" element={<OperatorBookingRequests />} />
              <Route path="bookings/:id" element={<OperatorBookingDetail />} />
              <Route path="payments" element={<OperatorPaymentVerification />} />
              <Route path="booking-log" element={<OperatorBookingLog />} />
              <Route path="invoices" element={<OperatorInvoices />} />
              <Route path="reports" element={<OperatorSalesReport />} />
              <Route path="notifications" element={<OperatorNotifications />} />
              <Route path="settings" element={<OperatorSettings />} />
              <Route path="help" element={<OperatorHelp />} />

            </Route>
          </Route>

          {/* Customer Routes */}
          <Route element={<ProtectedRoute allowedRoles={["CUSTOMER"]} />}>
            <Route path="/customer" element={<CustomerLayout />}>
              <Route index element={<Navigate to="bookings" replace />} />
              <Route path="bookings" element={<MyBookings />} />
              <Route path="bookings/:id" element={<BookingDetail />} />
              <Route path="checkout/:id" element={<Checkout />} />
              <Route path="payment-status/:id" element={<PaymentStatus />} />
              <Route path="upload-receipt/:id" element={<UploadReceipt />} />
              <Route path="payments" element={<CustomerPayments />} />
              <Route path="invoices" element={<CustomerInvoices />} />
              <Route path="invoices/:id" element={<CustomerInvoiceDetail />} />
              <Route path="notifications" element={<CustomerNotifications />} />
              <Route path="profile" element={<CustomerProfile />} />
              <Route path="help" element={<CustomerHelp />} />
            </Route>
          </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}