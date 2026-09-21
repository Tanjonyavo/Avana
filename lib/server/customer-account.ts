import "server-only";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import type { CustomerAddress, CustomerProfile } from "@/types/commerce";

interface AddressRow {
  id: string;
  label: string;
  first_name: string;
  last_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  province: string;
  postal_code: string;
  country: "CA";
  is_default: boolean;
}

function mapAddress(row: AddressRow): CustomerAddress {
  return {
    id: row.id,
    label: row.label,
    firstName: row.first_name,
    lastName: row.last_name,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    province: row.province,
    postalCode: row.postal_code,
    country: row.country,
    isDefault: row.is_default,
  };
}

export async function getCustomerAccount(
  userId: string,
  email: string,
): Promise<{ profile: CustomerProfile; addresses: CustomerAddress[] }> {
  const client = getSupabaseAdmin();
  const [profileResult, addressResult, subscriberResult] = await Promise.all([
    client.from("profiles").select("display_name, phone, marketing_consent").eq("id", userId).maybeSingle(),
    client
      .from("customer_addresses")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
    client.from("newsletter_subscribers").select("status").eq("email", email.toLowerCase()).maybeSingle(),
  ]);
  if (profileResult.error)
    throw new Error(`Customer profile could not be loaded: ${profileResult.error.code}`);
  if (addressResult.error)
    throw new Error(`Customer addresses could not be loaded: ${addressResult.error.code}`);
  if (subscriberResult.error)
    throw new Error(`Marketing preference could not be loaded: ${subscriberResult.error.code}`);
  return {
    profile: {
      displayName: profileResult.data?.display_name || "",
      phone: profileResult.data?.phone || "",
      marketingConsent: Boolean(
        profileResult.data?.marketing_consent || subscriberResult.data?.status === "subscribed",
      ),
    },
    addresses: (addressResult.data as AddressRow[]).map(mapAddress),
  };
}

export async function updateCustomerProfile(userId: string, email: string, input: CustomerProfile) {
  const { error } = await getSupabaseAdmin().rpc("update_customer_profile", {
    user_id_value: userId,
    email_value: email.toLowerCase(),
    display_name_value: input.displayName,
    phone_value: input.phone || null,
    marketing_consent_value: input.marketingConsent,
  });
  if (error) throw new Error(`Customer profile could not be updated: ${error.code}`);
}

export async function createCustomerAddress(userId: string, input: Omit<CustomerAddress, "id">) {
  const { data, error } = await getSupabaseAdmin().rpc("create_customer_address", {
    user_id_value: userId,
    address_value: input,
  });
  if (error) {
    if (error.message.includes("ADDRESS_LIMIT_REACHED")) throw new Error("ADDRESS_LIMIT_REACHED");
    throw new Error(`Customer address could not be created: ${error.code}`);
  }
  return data as string;
}

export async function updateCustomerAddress(userId: string, id: string, input: Omit<CustomerAddress, "id">) {
  const { data, error } = await getSupabaseAdmin().rpc("update_customer_address", {
    user_id_value: userId,
    address_id_value: id,
    address_value: input,
  });
  if (error) throw new Error(`Customer address could not be updated: ${error.code}`);
  return Boolean(data);
}

export async function deleteCustomerAddress(userId: string, id: string) {
  const { data, error } = await getSupabaseAdmin().rpc("delete_customer_address", {
    user_id_value: userId,
    address_id_value: id,
  });
  if (error) throw new Error(`Customer address could not be deleted: ${error.code}`);
  return Boolean(data);
}
