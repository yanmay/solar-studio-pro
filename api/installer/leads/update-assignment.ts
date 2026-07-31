import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Database configuration missing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const updateVal = z.object({
      assignmentId: z.string().min(1),
      installerUserId: z.string().min(1),
      status: z.enum(['delivered', 'viewed', 'contacted', 'site_visit', 'quoted', 'won', 'lost']).optional(),
      reminderDate: z.string().nullable().optional(),
      reminderNote: z.string().nullable().optional(),
      projectStage: z.enum(['lead', 'survey', 'design', 'install', 'commissioned']).nullable().optional(),
      projectAssignee: z.string().nullable().optional(),
      projectDueDate: z.string().nullable().optional(),
      projectNotes: z.string().nullable().optional()
    }).safeParse(body);

    if (!updateVal.success) {
      return new Response(JSON.stringify({ error: updateVal.error.issues[0].message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { 
      assignmentId, 
      installerUserId, 
      status, 
      reminderDate, 
      reminderNote,
      projectStage,
      projectAssignee,
      projectDueDate,
      projectNotes
    } = updateVal.data;

    // Retrieve installer profile
    const { data: installer, error: instErr } = await supabase
      .from('installer_profiles')
      .select('*')
      .eq('user_id', installerUserId)
      .single();

    if (instErr || !installer) {
      return new Response(JSON.stringify({ error: 'Installer profile not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Retrieve lead assignment to verify ownership
    const { data: assignment, error: assignErr } = await supabase
      .from('lead_assignments')
      .select('*')
      .eq('id', assignmentId)
      .single();

    if (assignErr || !assignment) {
      return new Response(JSON.stringify({ error: 'Lead assignment not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (assignment.installer_id !== installer.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized: installer does not own this lead assignment' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const updates: any = {};
    if (status !== undefined) {
      updates.status = status;
      if (status === 'won') {
        // Enforce server-side Won -> Project idempotency
        if (!assignment.project_stage) {
          updates.project_stage = 'lead';
        }
      }
    }
    if (reminderDate !== undefined) updates.reminder_date = reminderDate;
    if (reminderNote !== undefined) updates.reminder_note = reminderNote;
    if (projectStage !== undefined) updates.project_stage = projectStage;
    if (projectAssignee !== undefined) updates.project_assignee = projectAssignee;
    if (projectDueDate !== undefined) updates.project_due_date = projectDueDate;
    if (projectNotes !== undefined) updates.project_notes = projectNotes;

    const { error: updateErr } = await supabase
      .from('lead_assignments')
      .update(updates)
      .eq('id', assignmentId);

    if (updateErr) {
      return new Response(JSON.stringify({ error: 'Failed to update assignment', details: updateErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
