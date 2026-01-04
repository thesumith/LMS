-- ============================================================================
-- Multi-Tenant LMS SaaS - Attendance RLS Policies
-- ============================================================================
-- This migration implements Row Level Security for attendance tracking
-- All policies enforce strict tenant isolation and role-based access
-- ============================================================================

-- Enable RLS on all attendance tables
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ATTENDANCE_SESSIONS TABLE POLICIES
-- ============================================================================

-- SELECT: Teachers see sessions for their batches, Students see sessions for enrolled batches
CREATE POLICY "attendance_sessions_select"
ON attendance_sessions
FOR SELECT
USING (
    -- SUPER_ADMIN can see all active sessions
    (is_super_admin() AND deleted_at IS NULL)
    OR
    -- INSTITUTE_ADMIN can see all sessions in their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id() 
        AND deleted_at IS NULL)
    OR
    -- TEACHER can see sessions for batches they are assigned to
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        )
        AND deleted_at IS NULL)
    OR
    -- STUDENT can see sessions for batches they are enrolled in
    (has_role('STUDENT') 
        AND institute_id = get_user_institute_id()
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_students 
            WHERE student_id = auth.uid()
                AND status = 'active'
                AND deleted_at IS NULL
        )
        AND deleted_at IS NULL)
);

-- INSERT: Teachers can create manual sessions for their batches
CREATE POLICY "attendance_sessions_insert_teacher"
ON attendance_sessions
FOR INSERT
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id()
        AND batch_id IN (
            SELECT id 
            FROM batches 
            WHERE institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        ))
    OR
    -- TEACHER can create manual sessions for batches they are assigned to
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND created_by = auth.uid()
        AND session_type = 'manual' -- Teachers can only create manual sessions
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        ))
    -- Automatic sessions are created by trigger/function, not by users
);

-- UPDATE: Teachers can update sessions for their batches (only if not locked)
CREATE POLICY "attendance_sessions_update_teacher"
ON attendance_sessions
FOR UPDATE
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    -- TEACHER can update sessions for batches they are assigned to (only if not locked)
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND created_by = auth.uid()
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        )
        AND is_locked = false) -- Cannot update locked sessions
)
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND created_by = auth.uid()
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        )
        AND is_locked = false) -- Cannot update locked sessions
);

-- DELETE: Soft delete only, Teachers can delete their own sessions (only if not locked)
CREATE POLICY "attendance_sessions_delete_teacher"
ON attendance_sessions
FOR UPDATE -- Using UPDATE because we soft delete via deleted_at
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    -- TEACHER can soft delete their own sessions (only if not locked)
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND created_by = auth.uid()
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        )
        AND is_locked = false) -- Cannot delete locked sessions
)
WITH CHECK (
    (is_super_admin() OR has_role('INSTITUTE_ADMIN') OR has_role('TEACHER'))
    AND deleted_at IS NOT NULL
);

-- ============================================================================
-- ATTENDANCE_RECORDS TABLE POLICIES
-- ============================================================================

-- SELECT: Students see their own records, Teachers see records for their batches
CREATE POLICY "attendance_records_select"
ON attendance_records
FOR SELECT
USING (
    -- SUPER_ADMIN can see all active records
    (is_super_admin() AND deleted_at IS NULL)
    OR
    -- INSTITUTE_ADMIN can see all records in their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id() 
        AND deleted_at IS NULL)
    OR
    -- TEACHER can see records for batches they are assigned to
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        )
        AND deleted_at IS NULL)
    OR
    -- STUDENT can see their own records only
    (has_role('STUDENT') 
        AND student_id = auth.uid()
        AND deleted_at IS NULL)
);

-- INSERT: Teachers can create records for their batches, System can create automatic records
CREATE POLICY "attendance_records_insert"
ON attendance_records
FOR INSERT
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id()
        AND batch_id IN (
            SELECT id 
            FROM batches 
            WHERE institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        )
        AND student_id IN (
            SELECT id 
            FROM profiles 
            WHERE institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        ))
    OR
    -- TEACHER can create records for batches they are assigned to
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND marked_by = auth.uid()
        AND is_automatic = false -- Teachers create manual records
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        )
        AND session_id IN (
            SELECT id 
            FROM attendance_sessions 
            WHERE batch_id = batch_id
                AND is_locked = false -- Cannot add records to locked sessions
                AND deleted_at IS NULL
        )
        AND student_id IN (
            SELECT student_id 
            FROM batch_students 
            WHERE batch_id = batch_id
                AND status = 'active'
                AND deleted_at IS NULL
        ))
    -- Automatic records are created by trigger/function (SECURITY DEFINER)
    -- Note: SECURITY DEFINER functions bypass RLS, so automatic records can be inserted
);

-- UPDATE: Teachers can update records for their batches (only if session not locked)
CREATE POLICY "attendance_records_update_teacher"
ON attendance_records
FOR UPDATE
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    -- TEACHER can update records for batches they are assigned to (only if session not locked)
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        )
        AND session_id IN (
            SELECT id 
            FROM attendance_sessions 
            WHERE is_locked = false -- Cannot update records in locked sessions
                AND deleted_at IS NULL
        ))
    -- Students cannot update their own records
)
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        )
        AND session_id IN (
            SELECT id 
            FROM attendance_sessions 
            WHERE is_locked = false -- Cannot update records in locked sessions
                AND deleted_at IS NULL
        ))
        -- Note: Immutability of is_automatic flag is enforced via triggers/application logic
);

-- DELETE: Soft delete only, Teachers can delete records from their batches (only if session not locked)
CREATE POLICY "attendance_records_delete_teacher"
ON attendance_records
FOR UPDATE -- Using UPDATE because we soft delete via deleted_at
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    -- TEACHER can soft delete records from batches they are assigned to (only if session not locked)
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        )
        AND session_id IN (
            SELECT id 
            FROM attendance_sessions 
            WHERE is_locked = false -- Cannot delete records from locked sessions
                AND deleted_at IS NULL
        ))
)
WITH CHECK (
    (is_super_admin() OR has_role('INSTITUTE_ADMIN') OR has_role('TEACHER'))
    AND deleted_at IS NOT NULL
);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON POLICY "attendance_sessions_select" ON attendance_sessions IS 'Teachers see sessions for their batches. Students see sessions for enrolled batches.';
COMMENT ON POLICY "attendance_sessions_insert_teacher" ON attendance_sessions IS 'Teachers can create manual sessions for batches they are assigned to.';
COMMENT ON POLICY "attendance_sessions_update_teacher" ON attendance_sessions IS 'Teachers can update sessions only if not locked.';
COMMENT ON POLICY "attendance_records_select" ON attendance_records IS 'Students see their own records. Teachers see records for their batches.';
COMMENT ON POLICY "attendance_records_insert" ON attendance_records IS 'Teachers can create manual records. Automatic records created by trigger.';
COMMENT ON POLICY "attendance_records_update_teacher" ON attendance_records IS 'Teachers can update records only if session not locked.';

