import { NextRequest, NextResponse } from 'next/server';
import { submitLead } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { firstName, lastName, email, company, phone } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { success: false, error: 'First name, last name, and email are required' },
        { status: 400 }
      );
    }

    // Security: Input length validation
    const MAX_NAME_LENGTH = 50;
    const MAX_EMAIL_LENGTH = 254;
    const MAX_PHONE_LENGTH = 20;

    if (typeof firstName !== 'string' || firstName.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { success: false, error: 'First name must be 50 characters or less' },
        { status: 400 }
      );
    }

    if (typeof lastName !== 'string' || lastName.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { success: false, error: 'Last name must be 50 characters or less' },
        { status: 400 }
      );
    }

    if (typeof email !== 'string' || email.length > MAX_EMAIL_LENGTH) {
      return NextResponse.json(
        { success: false, error: 'Email must be 254 characters or less' },
        { status: 400 }
      );
    }

    if (phone && (typeof phone !== 'string' || phone.length > MAX_PHONE_LENGTH)) {
      return NextResponse.json(
        { success: false, error: 'Phone must be 20 characters or less' },
        { status: 400 }
      );
    }

    const MAX_COMPANY_LENGTH = 100;
    if (company && (typeof company !== 'string' || company.length > MAX_COMPANY_LENGTH)) {
      return NextResponse.json(
        { success: false, error: 'Company must be 100 characters or less' },
        { status: 400 }
      );
    }

    // Security: Improved email regex (RFC 5322 compliant subset)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const result = await submitLead({
      first_name: firstName,
      last_name: lastName,
      email,
      company: company || null,
      phone: phone || null,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Lead API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
