-- ============================================================================
-- Multi-Tenant LMS SaaS - Class Sessions (Live Classes) RLS Policies
-- ============================================================================
-- Enforces strict tenant isolation and role-based access for:
-- - class_sessions
-- - class_session_materials
-- ============================================================================

-- Enable RLS
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_session_materials ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CLASS_SESSIONS POLICIES
-- ============================================================================

-- SELECT: Admin sees all in institute; Teacher sees assigned batches; Student sees enrolled batches
CREATE POLICY "class_sessions_select"
ON class_sessions
FOR SELECT
USING (
    (is_super_admin() AND deleted_at IS NULL)
    OR
    (has_role('INSTITUTE_ADMIN')
        AND institute_id = get_user_institute_id()
        AND deleted_at IS NULL)
    OR
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

-- INSERT: Institute admin can create; Teacher can create only for assigned batches and must be the teacher_id
CREATE POLICY "class_sessions_insert"
ON class_sessions
FOR INSERT
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN')
        AND institute_id = get_user_institute_id())
    OR
    (has_role('TEACHER')
        AND institute_id = get_user_institute_id()
        AND teacher_id = auth.uid()
        AND batch_id IN (
            SELECT batch_id
            FROM batch_teachers
            WHERE teacher_id = auth.uid()
              AND deleted_at IS NULL
        ))
);

-- UPDATE: Institute admin can update; Teacher can update their own sessions (in assigned batches)
CREATE POLICY "class_sessions_update"
ON class_sessions
FOR UPDATE
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN')
        AND institute_id = get_user_institute_id())
    OR
    (has_role('TEACHER')
        AND institute_id = get_user_institute_id()
        AND teacher_id = auth.uid()
        AND batch_id IN (
            SELECT batch_id
            FROM batch_teachers
            WHERE teacher_id = auth.uid()
              AND deleted_at IS NULL
        ))
)
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN')
        AND institute_id = get_user_institute_id())
    OR
    (has_role('TEACHER')
        AND institute_id = get_user_institute_id()
        AND teacher_id = auth.uid()
        AND batch_id IN (
            SELECT batch_id
            FROM batch_teachers
            WHERE teacher_id = auth.uid()
              AND deleted_at IS NULL
        ))
);

-- DELETE: Soft delete via UPDATE only (same as update policy). No separate DELETE policy.

-- ============================================================================
-- CLASS_SESSION_MATERIALS POLICIES
-- ============================================================================

-- SELECT: Anyone who can see the class session can see its materials
CREATE POLICY "class_session_materials_select"
ON class_session_materials
FOR SELECT
USING (
    (is_super_admin() AND deleted_at IS NULL)
    OR
    (
        deleted_at IS NULL
        AND class_session_id IN (
            SELECT cs.id
            FROM class_sessions cs
            WHERE cs.deleted_at IS NULL
              AND (
                (has_role('INSTITUTE_ADMIN') AND cs.institute_id = get_user_institute_id())
                OR
                (has_role('TEACHER')
                    AND cs.institute_id = get_user_institute_id()
                    AND cs.batch_id IN (
                        SELECT batch_id
                        FROM batch_teachers
                        WHERE teacher_id = auth.uid()
                          AND deleted_at IS NULL
                    ))
                OR
                (has_role('STUDENT')
                    AND cs.institute_id = get_user_institute_id()
                    AND cs.batch_id IN (
                        SELECT batch_id
                        FROM batch_students
                        WHERE student_id = auth.uid()
                          AND status = 'active'
                          AND deleted_at IS NULL
                    ))
              )
        )
    )
);

-- INSERT: Admin or teacher (assigned batch) can upload materials; uploaded_by must be auth.uid()
CREATE POLICY "class_session_materials_insert"
ON class_session_materials
FOR INSERT
WITH CHECK (
    is_super_admin()
    OR
    (
        uploaded_by = auth.uid()
        AND (
            (has_role('INSTITUTE_ADMIN') AND institute_id = get_user_institute_id())
            OR
            (has_role('TEACHER')
                AND institute_id = get_user_institute_id()
                AND class_session_id IN (
                    SELECT cs.id
                    FROM class_sessions cs
                    WHERE cs.deleted_at IS NULL
                      AND cs.batch_id IN (
                        SELECT batch_id
                        FROM batch_teachers
                        WHERE teacher_id = auth.uid()
                          AND deleted_at IS NULL
                      )
                ))
        )
    )
);

-- UPDATE: Admin or teacher (assigned batch) can update (incl soft delete); teacher can only modify their uploads
CREATE POLICY "class_session_materials_update"
ON class_session_materials
FOR UPDATE
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') AND institute_id = get_user_institute_id())
    OR
    (has_role('TEACHER')
        AND institute_id = get_user_institute_id()
        AND uploaded_by = auth.uid()
        AND class_session_id IN (
            SELECT cs.id
            FROM class_sessions cs
            WHERE cs.deleted_at IS NULL
              AND cs.batch_id IN (
                SELECT batch_id
                FROM batch_teachers
                WHERE teacher_id = auth.uid()
                  AND deleted_at IS NULL
              )
        ))
)
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') AND institute_id = get_user_institute_id())
    OR
    (has_role('TEACHER')
        AND institute_id = get_user_institute_id()
        AND uploaded_by = auth.uid()
        AND class_session_id IN (
            SELECT cs.id
            FROM class_sessions cs
            WHERE cs.deleted_at IS NULL
              AND cs.batch_id IN (
                SELECT batch_id
                FROM batch_teachers
                WHERE teacher_id = auth.uid()
                  AND deleted_at IS NULL
              )
        ))
);

COMMENT ON POLICY "class_sessions_select" ON class_sessions IS 'Admin sees institute sessions; teacher sees sessions for assigned batches; student sees sessions for enrolled batches.';
COMMENT ON POLICY "class_sessions_insert" ON class_sessions IS 'Admin can create; teacher can create sessions only for assigned batches and must be teacher_id.';
COMMENT ON POLICY "class_sessions_update" ON class_sessions IS 'Admin can update; teacher can update their own sessions in assigned batches.';
COMMENT ON POLICY "class_session_materials_select" ON class_session_materials IS 'Users can view materials for class sessions they can view.';
COMMENT ON POLICY "class_session_materials_insert" ON class_session_materials IS 'Admin/teacher can upload materials; uploaded_by must match auth.uid().';
COMMENT ON POLICY "class_session_materials_update" ON class_session_materials IS 'Admin can update; teacher can update only their own materials for assigned batches.';


