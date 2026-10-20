/**
 * Clerk + admin feature checks. Imported into regression.js so CI runs them together.
 * Staff accounts must be seeded: npx tsx scripts/seedTestUsers.ts
 */
import { check, group } from 'k6';

import {
  authDelete,
  authGet,
  authPost,
} from '../lib/http.js';

export function runStaffAccessControlTests({ customerToken, clerkToken, adminToken }) {
  group('Staff access control', () => {
    const customerBlocked = authGet('/staff/warehouse/summary', customerToken, 403);
    check(customerBlocked, {
      'customer blocked from warehouse summary': (r) => r.status === 403,
    });

    const customerAdminBlocked = authGet('/admin/stats/overview', customerToken, 403);
    check(customerAdminBlocked, {
      'customer blocked from admin stats': (r) => r.status === 403,
    });

    const clerkAdminBlocked = authGet('/admin/stats/overview', clerkToken, 403);
    check(clerkAdminBlocked, {
      'clerk blocked from admin stats': (r) => r.status === 403,
    });

    const clerkClerksBlocked = authGet('/admin/clerks', clerkToken, 403);
    check(clerkClerksBlocked, {
      'clerk blocked from admin clerks list': (r) => r.status === 403,
    });
  });
}

export function runClerkFeatureTests({ clerkToken }) {
  group('Clerk warehouse', () => {
    const summary = authGet('/staff/warehouse/summary', clerkToken);
    check(summary, {
      'warehouse summary 200': (r) => r.status === 200,
      'warehouse summary has status_counts': (r) => typeof r.json('status_counts') === 'object',
      'warehouse summary has packages_today': (r) => typeof r.json('packages_today') === 'number',
      'warehouse summary has pending_delivery_requests': (r) =>
        typeof r.json('pending_delivery_requests') === 'number',
      'warehouse summary has print_queue_pending': (r) =>
        typeof r.json('print_queue_pending') === 'number',
    });

    const customers = authGet('/warehouse/customers?limit=10', clerkToken);
    check(customers, {
      'warehouse customers 200': (r) => r.status === 200,
      'warehouse customers array': (r) => Array.isArray(r.json('customers')),
      'warehouse customers total': (r) => typeof r.json('total') === 'number',
    });

    const searchShort = authGet('/warehouse/customers/search?q=a', clerkToken);
    check(searchShort, {
      'customer search short query empty': (r) =>
        r.status === 200 && Array.isArray(r.json('customers')) && r.json('customers').length === 0,
    });

    const search = authGet('/warehouse/customers/search?q=brown', clerkToken);
    check(search, {
      'customer search 200': (r) => r.status === 200,
      'customer search array': (r) => Array.isArray(r.json('customers')),
    });

    const preAlerts = authGet('/staff/pre-alerts?limit=10', clerkToken);
    check(preAlerts, {
      'staff pre-alerts 200': (r) => r.status === 200,
      'staff pre-alerts array': (r) => Array.isArray(r.json('pre_alerts')),
    });

    const lookupMissing = authGet('/staff/pre-alerts/lookup', clerkToken, 400);
    check(lookupMissing, {
      'pre-alert lookup missing tracking 400': (r) => r.status === 400,
    });

    const lookup = authGet(
      '/staff/pre-alerts/lookup?carrier_tracking=NOSUCHTRACKING999',
      clerkToken,
    );
    check(lookup, {
      'pre-alert lookup 200': (r) => r.status === 200,
      'pre-alert lookup matches array': (r) => Array.isArray(r.json('matches')),
    });

    const batches = authGet('/staff/receive-batches?status=open&limit=10', clerkToken);
    check(batches, {
      'receive batches 200': (r) => r.status === 200,
      'receive batches array': (r) => Array.isArray(r.json('receive_batches')),
    });

    const unidentified = authGet('/staff/packages/unidentified', clerkToken);
    check(unidentified, {
      'unidentified queue 200': (r) => r.status === 200,
      'unidentified packages array': (r) => Array.isArray(r.json('packages')),
    });

    const printQueue = authGet('/staff/packages/print-queue', clerkToken);
    check(printQueue, {
      'print queue 200': (r) => r.status === 200,
      'print queue packages array': (r) => Array.isArray(r.json('packages')),
    });

    const recent = authGet('/staff/packages/my-recent-receives', clerkToken);
    check(recent, {
      'my recent receives 200': (r) => r.status === 200,
      'my recent receives array': (r) => Array.isArray(r.json('receives')),
    });

    const pkgSearch = authGet('/staff/packages/search?q=PB-2026', clerkToken);
    check(pkgSearch, {
      'package search 200': (r) => r.status === 200,
      'package search matches array': (r) => Array.isArray(r.json('matches')),
    });

    const deliveryRequests = authGet('/staff/delivery-requests?status=active', clerkToken);
    check(deliveryRequests, {
      'staff delivery requests 200': (r) => r.status === 200,
      'staff delivery requests array': (r) => Array.isArray(r.json('delivery_requests')),
    });

    const shipments = authGet('/staff/shipments', clerkToken);
    check(shipments, {
      'staff shipments 200': (r) => r.status === 200,
      'staff shipments array': (r) => Array.isArray(r.json('shipments')),
    });

    const activity = authGet('/admin/activity?limit=10', clerkToken);
    check(activity, {
      'clerk activity log 200': (r) => r.status === 200,
      'clerk activity array': (r) => Array.isArray(r.json('activity')),
      'clerk activity total': (r) => typeof r.json('total') === 'number',
    });

    const missingCustomer = authGet('/staff/customers/BOSS-DOES-NOT-EXIST', clerkToken, 404);
    check(missingCustomer, {
      'missing customer 404': (r) => r.status === 404,
    });
  });
}

export function runAdminFeatureTests({ adminToken }) {
  group('Admin stats', () => {
    const overview = authGet('/admin/stats/overview', adminToken);
    check(overview, {
      'admin overview 200': (r) => r.status === 200,
      'admin overview packages_total': (r) => typeof r.json('packages_total') === 'number',
      'admin overview customers_total': (r) => typeof r.json('customers_total') === 'number',
      'admin overview delivery_requests_total': (r) =>
        typeof r.json('delivery_requests_total') === 'number',
    });

    const byStatus = authGet('/admin/stats/by-status', adminToken);
    check(byStatus, {
      'admin by-status 200': (r) => r.status === 200,
      'admin by-status array': (r) => Array.isArray(r.json('statuses')),
    });

    const signups = authGet('/admin/stats/customer-signups', adminToken);
    check(signups, {
      'admin customer signups 200': (r) => r.status === 200,
      'admin customer signups total': (r) => typeof r.json('customers_total') === 'number',
    });

    const deliveryStats = authGet('/admin/stats/delivery-requests', adminToken);
    check(deliveryStats, {
      'admin delivery request stats 200': (r) => r.status === 200,
      'admin delivery request stats active': (r) =>
        typeof r.json('delivery_requests_active') === 'number',
    });

    const proofStats = authGet('/admin/stats/bank-transfer-proofs', adminToken);
    check(proofStats, {
      'admin bank proof stats 200': (r) => r.status === 200,
      'admin bank proof stats total': (r) =>
        typeof r.json('bank_transfer_proofs_total') === 'number',
    });

    const timeline = authGet('/admin/stats/packages-timeline?days=30', adminToken);
    check(timeline, {
      'admin packages timeline 200': (r) => r.status === 200,
      'admin packages timeline array': (r) => Array.isArray(r.json('timeline')),
    });

    const weight = authGet('/admin/stats/weight-distribution', adminToken);
    check(weight, {
      'admin weight distribution 200': (r) => r.status === 200,
      'admin weight distribution array': (r) => Array.isArray(r.json('distribution')),
    });

    const preVsRecv = authGet('/admin/stats/pre-alerts-vs-receives?days=30', adminToken);
    check(preVsRecv, {
      'admin pre-alerts vs receives 200': (r) => r.status === 200,
      'admin pre-alerts vs receives series': (r) => Array.isArray(r.json('series')),
    });
  });

  group('Admin clerks & settings', () => {
    const perms = authGet('/admin/clerk-permissions', adminToken);
    check(perms, {
      'clerk permissions 200': (r) => r.status === 200,
      'clerk permissions array': (r) => Array.isArray(r.json('permissions')),
      'clerk permissions non-empty': (r) => r.json('permissions').length > 0,
    });

    const clerks = authGet('/admin/clerks', adminToken);
    check(clerks, {
      'admin clerks 200': (r) => r.status === 200,
      'admin clerks array': (r) => Array.isArray(r.json('clerks')),
      'admin clerks includes seeded clerk': (r) =>
        r.json('clerks').some((c) => c.email === 'clerk@package-boss.test'),
    });

    const emailSettings = authGet('/admin/settings/customer-email-notifications', adminToken);
    check(emailSettings, {
      'email notification settings 200': (r) => r.status === 200,
      'email notification settings has enabled': (r) =>
        typeof r.json('customer_email_notifications_enabled') === 'boolean',
    });

    const invoices = authGet('/admin/invoices?limit=10', adminToken);
    check(invoices, {
      'admin invoices 200': (r) => r.status === 200,
      'admin invoices array': (r) => Array.isArray(r.json('invoices')),
      'admin invoices summary': (r) => typeof r.json('summary') === 'object',
    });

    const activity = authGet('/admin/activity?limit=10', adminToken);
    check(activity, {
      'admin activity 200': (r) => r.status === 200,
      'admin activity array': (r) => Array.isArray(r.json('activity')),
    });
  });

  group('Admin announcements', () => {
    const list = authGet('/admin/announcements', adminToken);
    check(list, {
      'admin announcements list 200': (r) => r.status === 200,
      'admin announcements array': (r) => Array.isArray(r.json('announcements')),
    });

    const preview = authPost(
      '/admin/announcements/preview-recipients',
      adminToken,
      { target_criteria: { package_statuses: ['ready_for_pickup'] } },
    );
    check(preview, {
      'preview recipients 200': (r) => r.status === 200,
      'preview has customer_count': (r) => typeof r.json('preview.customer_count') === 'number',
      'preview has package_count': (r) => typeof r.json('preview.package_count') === 'number',
      'preview customers array': (r) => Array.isArray(r.json('preview.customers')),
    });

    const previewEmpty = authPost(
      '/admin/announcements/preview-recipients',
      adminToken,
      { target_criteria: {} },
      400,
    );
    check(previewEmpty, {
      'preview empty criteria 400': (r) => r.status === 400,
    });

    const created = authPost('/admin/announcements', adminToken, {
      title: 'K6 regression announcement',
      body: 'Temporary announcement created by k6 regression suite.',
      severity: 'info',
      audience: 'customers',
      target_mode: 'broadcast',
      display_as: 'inbox_only',
      is_active: true,
      dismissible: true,
    });
    check(created, {
      'create announcement 201': (r) => r.status === 201,
      'create announcement has id': (r) => typeof r.json('announcement.id') === 'string',
    });

    const announcementId = created.json('announcement.id');
    if (announcementId) {
      const deleted = authDelete(`/admin/announcements/${announcementId}`, adminToken);
      check(deleted, {
        'delete announcement 200': (r) => r.status === 200,
      });
    }
  });

  group('Admin warehouse (full access)', () => {
    const summary = authGet('/staff/warehouse/summary', adminToken);
    check(summary, {
      'admin can read warehouse summary': (r) => r.status === 200,
    });

    const customers = authGet('/warehouse/customers?limit=5', adminToken);
    check(customers, {
      'admin can list warehouse customers': (r) =>
        r.status === 200 && Array.isArray(r.json('customers')),
    });
  });
}
