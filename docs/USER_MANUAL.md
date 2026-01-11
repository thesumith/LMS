# LMS User Manual

Welcome to the Learning Management System (LMS). This manual provides detailed instructions for using the platform based on your role.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Super Admin Manual](#super-admin-manual)
3. [Institute Admin Manual](#institute-admin-manual)
4. [Teacher Manual](#teacher-manual)
5. [Student Manual](#student-manual)
6. [Common Features](#common-features)

---

## Getting Started

### First-Time Login

1. **Access the Login Page**
   - Navigate to the login page at `/login`
   - Or access your institute's subdomain (e.g., `your-institute.platform.com/login`)

2. **Enter Your Credentials**
   - Enter your email address
   - Enter your password
   - Click "Sign In"

3. **Change Password (If Required)**
   - If this is your first login or your password was reset, you'll be prompted to change your password
   - Enter your current temporary password
   - Create a new secure password (minimum 8 characters)
   - Confirm your new password
   - Click "Change Password"

4. **Access Your Dashboard**
   - After successful login, you'll be redirected to your role-specific dashboard

### Accessing Your Institute

- **Super Admins**: Can access from the main domain or any subdomain
- **All Other Roles**: Must access via your institute's subdomain
  - Format: `your-institute.platform.com`
  - Example: If your institute subdomain is "acme", access via `acme.platform.com`

### Navigation

- Use the sidebar menu to navigate between different sections
- Your dashboard provides an overview of key metrics
- Click on any item to view details

---

## Super Admin Manual

Super Admins manage the entire platform, overseeing all institutes and users.

### Dashboard

**Location:** `/super-admin/dashboard`

The Super Admin Dashboard provides platform-wide statistics:

- **Total Institutes**: Number of institutes on the platform
- **Active Institutes**: Number of currently active institutes
- **Total Users**: Total number of users across all institutes
- **Users by Role**: Breakdown of users by role (Super Admin, Institute Admin, Teachers, Students)
- **Total Courses**: Total courses across all institutes
- **Recent Institutes**: List of recently created institutes

**How to Use:**
- View platform health and growth metrics
- Monitor overall system usage
- Track new institute registrations

### Institutes Management

**Location:** `/super-admin/institutes`

Create and manage all institutes on the platform.

#### Creating a New Institute

1. Click the "+ Create Institute" button
2. Fill in the form:
   - **Institute Name**: Full name of the institute (e.g., "Acme University")
   - **Subdomain**: Unique subdomain identifier (e.g., "acme")
     - Must be lowercase, alphanumeric with hyphens
     - Must be unique across the platform
   - **Admin Name**: Full name of the institute's first administrator
   - **Admin Email**: Email address for the institute admin
   - **Password**: Choose to generate a temporary password (sent via email) or set a custom password
3. Click "Create Institute"
4. The institute admin will receive login credentials via email (if password was auto-generated)

#### Viewing Institutes

- View all institutes in a table format
- See institute name, subdomain, status (active/suspended), and creation date
- Status indicators show whether the institute is active

**Features:**
- View all institutes at a glance
- Monitor institute status
- Track creation dates

### Users Management

**Location:** `/super-admin/users`

View and manage users across all institutes.

**Features:**
- View all users in the platform
- See user roles and institute affiliations
- Monitor user activity

### Settings

**Location:** `/super-admin/settings`

Configure platform-wide settings.

**Features:**
- Platform configuration
- System settings
- Global preferences

---

## Institute Admin Manual

Institute Admins manage their specific institute, including users, courses, batches, and certificates.

### Dashboard

**Location:** `/admin/dashboard` (accessed via your institute subdomain)

The Institute Admin Dashboard shows key metrics for your institute:

- **Total Students**: Number of students in your institute
- **Total Teachers**: Number of teachers in your institute
- **Active Courses**: Number of active courses
- **Active Batches**: Number of active batches
- **Total Certificates**: Number of certificates issued
- **Average Attendance**: Average attendance percentage across all batches
- **Completion Rate**: Overall course completion rate
- **Recent Certificates**: List of recently issued certificates

**How to Use:**
- Monitor institute performance
- Track student and teacher counts
- View recent certificate issuances
- Assess attendance and completion rates

### Users Management

**Location:** `/admin/users`

Manage all users in your institute (students, teachers, and other admins).

#### Creating Users

1. Click "Create User" or "+ Add User"
2. Fill in user details:
   - **Name**: User's full name
   - **Email**: User's email address (must be unique)
   - **Role**: Select role (INSTITUTE_ADMIN, TEACHER, or STUDENT)
   - **Password**: Generate temporary password or set custom password
3. Click "Create User"
4. User will receive login credentials via email (if password was auto-generated)

#### Managing Users

- View all users in a table
- Filter by role (Admin, Teacher, Student)
- Edit user details
- Deactivate users (soft delete)
- Reset user passwords

**Note:** Users cannot change their own roles or institute. Only Super Admins can manage Super Admin accounts.

### Courses Management

**Location:** `/admin/courses`

Create and manage courses in your institute.

#### Creating a Course

1. Click "Create Course" or "+ Add Course"
2. Fill in course details:
   - **Course Name**: Full name of the course
   - **Course Code**: Short code (e.g., "CS101")
   - **Description**: Course description
   - **Duration**: Course duration
   - **Status**: Active or Inactive
3. Click "Create Course"

#### Managing Courses

- View all courses
- Edit course details
- Deactivate courses
- View course details, modules, and lessons
- Set certificate eligibility rules

#### Certificate Rules

For each course, you can configure certificate eligibility:

1. Navigate to a course's detail page
2. Go to "Certificate Rules" section
3. Set requirements:
   - **Minimum Attendance Percentage**: Required attendance (0-100%)
   - **Require Exam Pass**: Whether students must pass exams
   - **Require Assignment Completion**: Whether all assignments must be completed
4. Save the rules

### Batches Management

**Location:** `/admin/batches`

Create and manage batches (course offerings) for your courses.

#### Creating a Batch

1. Click "Create Batch" or "+ Add Batch"
2. Fill in batch details:
   - **Batch Name**: Name for this batch (e.g., "Fall 2024")
   - **Course**: Select the course
   - **Start Date**: Batch start date
   - **End Date**: Batch end date
   - **Status**: Active or Inactive
3. Click "Create Batch"

#### Managing Batches

- View all batches
- Edit batch details
- Assign teachers to batches
- Enroll students in batches
- View batch details, students, and teachers
- Manage batch enrollment

#### Assigning Teachers to Batches

1. Navigate to a batch's detail page
2. Go to "Teachers" section
3. Click "Assign Teachers"
4. Select one or more teachers
5. Click "Assign"

#### Enrolling Students in Batches

1. Navigate to a batch's detail page
2. Go to "Students" section
3. Click "Enroll Students"
4. Select one or more students
5. Click "Enroll"

### Certificates Management

**Location:** `/admin/certificates`

View and manage certificates issued by your institute.

#### Viewing Certificates

- View all issued certificates
- Filter by course, batch, or student
- View certificate details
- Download certificate PDFs

#### Issuing Certificates

1. Navigate to the certificate page
2. Click "Issue Certificate"
3. Select:
   - **Student**: Student to issue certificate to
   - **Course**: Course for which certificate is issued
   - **Batch**: Specific batch
4. System checks eligibility automatically
5. If eligible, certificate is generated and issued
6. If not eligible, view eligibility details

**Certificate Eligibility:**
- System automatically checks if student meets course requirements
- Requirements are based on certificate rules set for the course
- Includes attendance percentage, exam pass status, and assignment completion

#### Reissuing Certificates

1. Find the certificate to reissue
2. Click "Reissue Certificate"
3. Choose whether to generate a new certificate number
4. Click "Reissue"
5. New certificate PDF is generated

### Settings

**Location:** `/admin/settings`

Configure institute-specific settings.

**Features:**
- Institute profile settings
- Preferences
- Configuration options

---

## Teacher Manual

Teachers manage their assigned batches, create assignments, mark attendance, and evaluate student work.

### Dashboard

**Location:** `/teacher/dashboard` (accessed via your institute subdomain)

The Teacher Dashboard shows:

- **Assigned Batches**: Number of batches you're teaching
- **Total Students**: Total students across all your batches
- **Pending Evaluations**: Number of assignment submissions awaiting evaluation
- **Average Progress**: Average progress percentage across all batches
- **Recent Submissions**: List of recent assignment submissions
- **Upcoming Sessions**: Attendance sessions scheduled for the next 7 days

**How to Use:**
- Monitor your teaching workload
- Track pending evaluations
- View upcoming attendance sessions
- Check student progress

### My Batches

**Location:** `/teacher/batches`

View all batches assigned to you.

#### Viewing Batch Details

1. Click on a batch to view details
2. View batch information:
   - Course details
   - Batch dates
   - Student list
   - Assignments
   - Attendance sessions

#### Viewing Students in a Batch

1. Navigate to a batch's detail page
2. Go to "Students" section
3. View:
   - Student list with enrollment status
   - Student progress
   - Attendance records
   - Assignment submissions

### Assignments

**Location:** `/teacher/assignments`

Create and manage assignments for your batches.

#### Creating an Assignment

1. Navigate to a batch's detail page
2. Go to "Assignments" section
3. Click "Create Assignment"
4. Fill in assignment details:
   - **Title**: Assignment title
   - **Description**: Detailed description
   - **Due Date**: Date students should submit by
   - **Submission Deadline**: Final deadline (can be later than due date for late submissions)
   - **Maximum Marks**: Maximum marks for the assignment
   - **Active Status**: Whether assignment is active
5. Click "Create Assignment"

**Note:** Once students submit assignments, you cannot edit the assignment details.

#### Viewing Assignments

- View all assignments for your batches
- See assignment status (active/inactive)
- View submission counts
- Access assignment details

#### Evaluating Submissions

1. Navigate to an assignment's detail page
2. View all student submissions
3. For each submission:
   - Download the submitted file
   - Enter marks (0 to maximum marks)
   - Provide feedback comments
   - Click "Evaluate" or "Save Evaluation"
4. Submissions are marked as evaluated with timestamp

**Features:**
- View all submissions for an assignment
- Filter by evaluation status (evaluated/pending)
- Filter by late submissions
- Bulk evaluation support
- Download student files

#### Viewing Assignment Details

1. Click on an assignment to view details
2. See:
   - Assignment information
   - All submissions
   - Submission statistics
   - Individual student submissions with marks and feedback

### Attendance

**Location:** `/teacher/attendance`

Create attendance sessions and mark student attendance.

#### Creating an Attendance Session

1. Navigate to a batch's detail page
2. Go to "Attendance" section
3. Click "Create Attendance Session"
4. Fill in session details:
   - **Session Date**: Date of the attendance session
   - **Title**: Optional title (e.g., "Week 10 Class")
   - **Description**: Optional description
5. Click "Create Session"

#### Marking Attendance

1. Navigate to an attendance session
2. View student list
3. Mark attendance for each student:
   - **Present**: Student is present
   - **Absent**: Student is absent
   - **Late**: Student arrived late
   - **Excused**: Student has a valid excuse
4. Add optional notes for each student
5. Click "Save Attendance"

**Bulk Marking:**
- Select multiple students
- Mark them all with the same status
- Save in one action

#### Locking Attendance Sessions

1. After marking all attendance
2. Click "Lock Session"
3. Locked sessions cannot be edited
4. This prevents accidental changes to attendance records

**Note:** Locking is permanent. Once locked, attendance cannot be modified.

#### Viewing Attendance Sessions

- View all attendance sessions for your batches
- Filter by date range
- Filter by session type (manual/automatic)
- View attendance statistics

**Automatic Attendance:**
- System automatically marks attendance when students complete lessons
- These appear as "automatic" sessions
- Teachers can view but not modify automatic attendance

### Students

**Location:** `/teacher/students`

View all students across your assigned batches.

**Features:**
- View student list
- Filter by batch
- View student profiles
- Check student progress
- View attendance records
- See assignment submissions

---

## Student Manual

Students view courses, complete lessons, submit assignments, track progress, and download certificates.

### Dashboard

**Location:** `/student/dashboard` (accessed via your institute subdomain)

The Student Dashboard shows:

- **Enrolled Courses**: Number of courses you're enrolled in
- **Total Progress**: Overall progress across all courses
- **Certificates**: Number of certificates you've earned
- **Upcoming Exams**: Exams scheduled in the next 30 days
- **Recent Assignments**: Assignments due in the next 7 days
- **Attendance Summary**: Your attendance statistics for the last 30 days

**How to Use:**
- Monitor your learning progress
- Stay on top of upcoming assignments and exams
- Track your attendance
- View earned certificates

### My Courses

**Location:** `/student/courses`

View all courses you're enrolled in.

#### Viewing Course Details

1. Click on a course to view details
2. See:
   - Course information
   - Batches you're enrolled in
   - Course modules and lessons
   - Your progress for each batch

#### Tracking Progress

- View progress percentage for each course/batch
- See which lessons you've completed
- Track your learning journey
- Monitor completion status

**Progress Calculation:**
- Progress is calculated based on completed lessons
- Each lesson must be marked as complete
- Progress percentage updates automatically

### Assignments

**Location:** `/student/assignments`

View and submit assignments.

#### Viewing Assignments

- View all assignments for your enrolled batches
- See assignment details:
  - Title and description
  - Due date and submission deadline
  - Maximum marks
  - Your submission status
  - Marks and feedback (if evaluated)

#### Submitting an Assignment

1. Click on an assignment to view details
2. Click "Submit Assignment"
3. Upload your file:
   - Supported formats: PDF, DOC, DOCX
   - Maximum file size: 10MB
4. Click "Submit"
5. Confirmation message shows submission status

**Important:**
- You can only submit once per assignment
- Submissions cannot be modified after submission
- Late submissions are automatically marked as "late"
- Submitted files are securely stored

#### Viewing Submission Status

1. Navigate to an assignment
2. View your submission:
   - Submission date and time
   - Late status (if applicable)
   - Marks received (if evaluated)
   - Teacher feedback (if evaluated)
   - Download your submitted file

#### Viewing Evaluated Assignments

- View marks and feedback from teachers
- Download your submitted files
- See evaluation timestamp
- Track your assignment grades

### Certificates

**Location:** `/student/certificates`

View and download your earned certificates.

#### Viewing Certificates

- View all certificates you've earned
- See certificate details:
  - Course name and code
  - Batch information
  - Certificate number
  - Issue date
  - Download link

#### Downloading Certificates

1. Navigate to the Certificates page
2. Find the certificate you want to download
3. Click "Download" or "View Certificate"
4. PDF certificate opens or downloads
5. Save or print as needed

**Certificate Verification:**
- Each certificate has a unique certificate number
- Certificate numbers can be verified publicly
- Certificates are securely stored and cannot be forged

### Grades

**Location:** `/student/grades`

View your grades and academic performance.

**Features:**
- View all assignment grades
- See marks received for each assignment
- View feedback from teachers
- Track your academic progress
- Calculate overall averages (if applicable)

#### Understanding Grades

- **Marks**: Points received out of maximum marks
- **Feedback**: Comments from your teacher
- **Submission Status**: Whether assignment was submitted on time or late
- **Evaluation Date**: When the assignment was evaluated

---

## Common Features

### Password Management

#### Changing Your Password

1. Navigate to Settings (if available) or use the change password page
2. Enter your current password
3. Enter your new password (minimum 8 characters)
4. Confirm your new password
5. Click "Change Password"

**Note:** If you're required to change your password on first login, you'll be redirected to the change password page automatically.

### Logging Out

1. Click on your profile/account menu (if available)
2. Click "Logout" or "Sign Out"
3. You'll be redirected to the login page

### Getting Help

- Contact your Institute Admin for account-related issues
- Contact your Teacher for course-related questions
- Contact platform support for technical issues

### Best Practices

#### For Students
- Check your dashboard regularly for updates
- Submit assignments before the due date
- Track your progress and complete lessons on time
- Maintain good attendance
- Download and save your certificates

#### For Teachers
- Create assignments with clear instructions
- Mark attendance regularly
- Evaluate submissions promptly
- Provide constructive feedback
- Lock attendance sessions after completion

#### For Institute Admins
- Keep user information up to date
- Configure certificate rules appropriately
- Monitor institute performance via dashboard
- Manage batches and enrollments efficiently
- Review certificate issuances regularly

---

## Troubleshooting

### Login Issues

**Problem:** Cannot log in
- **Solution:** Verify your email and password are correct
- Check if you're using the correct subdomain
- Contact your Institute Admin if you've forgotten your password

**Problem:** Password change required
- **Solution:** You'll be automatically redirected to change your password page
- Follow the instructions to set a new password

### Access Issues

**Problem:** Cannot access a page
- **Solution:** Verify you have the correct role permissions
- Ensure you're accessing via the correct subdomain
- Contact your Institute Admin if you believe you should have access

**Problem:** Page shows "Unauthorized"
- **Solution:** You don't have permission to access this page
- Contact your Institute Admin if you need additional permissions

### Assignment Issues

**Problem:** Cannot submit assignment
- **Solution:** Verify the assignment deadline hasn't passed
- Check file format (PDF, DOC, DOCX) and size (max 10MB)
- Ensure you haven't already submitted

**Problem:** Assignment shows as "late"
- **Solution:** Late submissions are automatically marked if submitted after the deadline
- You can still submit, but it will be marked as late

### Certificate Issues

**Problem:** Certificate not issued
- **Solution:** Check if you meet eligibility requirements
- Contact your Institute Admin to verify certificate rules
- View eligibility details in the certificate section

**Problem:** Cannot download certificate
- **Solution:** Check your internet connection
- Try again after a few moments
- Contact support if the issue persists

---

## Security Notes

- **Never share your password** with anyone
- **Log out** when using shared computers
- **Use strong passwords** (minimum 8 characters, mix of letters, numbers, and symbols)
- **Report suspicious activity** to your Institute Admin immediately
- **Keep your account information** up to date

---

## Support

For additional help:
- **Students**: Contact your Teacher or Institute Admin
- **Teachers**: Contact your Institute Admin
- **Institute Admins**: Contact platform support or Super Admin
- **Super Admins**: Contact platform support team

---

*Last Updated: Based on current system version*

