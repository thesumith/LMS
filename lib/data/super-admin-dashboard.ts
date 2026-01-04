/**
 * Super Admin Dashboard Data
 * 
 * Server-side functions for fetching platform-wide analytics.
 * Super admin can see all data across all institutes.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';

export interface SuperAdminDashboard {
  totalInstitutes: number;
  activeInstitutes: number;
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalInstituteAdmins: number;
  totalCourses: number;
  totalBatches: number;
  totalCertificates: number;
  recentInstitutes: Array<{
    id: string;
    name: string;
    subdomain: string;
    status: string;
    created_at: string;
  }>;
}

/**
 * Get super admin dashboard statistics
 * 
 * Returns platform-wide statistics across all institutes.
 * 
 * @returns Dashboard statistics
 */
export async function getSuperAdminDashboard(): Promise<SuperAdminDashboard> {
  // Get total institutes
  const { count: totalInstitutes, error: institutesError } = await supabaseAdmin
    .from('institutes')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);

  if (institutesError) {
    throw new Error(`Failed to fetch institutes: ${institutesError.message}`);
  }

  // Get active institutes
  const { count: activeInstitutes, error: activeError } = await supabaseAdmin
    .from('institutes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .is('deleted_at', null);

  if (activeError) {
    throw new Error(`Failed to fetch active institutes: ${activeError.message}`);
  }

  // Get total users by role (simplified - role_name is stored directly)
  const { data: roleCounts, error: rolesError } = await supabaseAdmin
    .from('user_roles')
    .select('role_name')
    .is('deleted_at', null);

  if (rolesError) {
    throw new Error(`Failed to fetch user roles: ${rolesError.message}`);
  }

  const roleMap = roleCounts?.reduce((acc: Record<string, number>, item: any) => {
    const roleName = item.role_name;
    if (roleName) {
      acc[roleName] = (acc[roleName] || 0) + 1;
    }
    return acc;
  }, {}) || {};

  // Get total profiles (unique users)
  const { count: totalUsers, error: usersError } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);

  if (usersError) {
    throw new Error(`Failed to fetch users: ${usersError.message}`);
  }

  // Get total courses
  const { count: totalCourses, error: coursesError } = await supabaseAdmin
    .from('courses')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);

  if (coursesError) {
    throw new Error(`Failed to fetch courses: ${coursesError.message}`);
  }

  // Get total batches
  const { count: totalBatches, error: batchesError } = await supabaseAdmin
    .from('batches')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);

  if (batchesError) {
    throw new Error(`Failed to fetch batches: ${batchesError.message}`);
  }

  // Get total certificates
  const { count: totalCertificates, error: certificatesError } = await supabaseAdmin
    .from('certificates')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);

  if (certificatesError) {
    throw new Error(`Failed to fetch certificates: ${certificatesError.message}`);
  }

  // Get recent institutes
  const { data: recentInstitutes, error: recentError } = await supabaseAdmin
    .from('institutes')
    .select('id, name, subdomain, status, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (recentError) {
    throw new Error(`Failed to fetch recent institutes: ${recentError.message}`);
  }

  return {
    totalInstitutes: totalInstitutes || 0,
    activeInstitutes: activeInstitutes || 0,
    totalUsers: totalUsers || 0,
    totalStudents: roleMap.STUDENT || 0,
    totalTeachers: roleMap.TEACHER || 0,
    totalInstituteAdmins: roleMap.INSTITUTE_ADMIN || 0,
    totalCourses: totalCourses || 0,
    totalBatches: totalBatches || 0,
    totalCertificates: totalCertificates || 0,
    recentInstitutes: (recentInstitutes || []).map((inst) => ({
      id: inst.id,
      name: inst.name,
      subdomain: inst.subdomain,
      status: inst.status,
      created_at: inst.created_at,
    })),
  };
}

