import "server-only";
import { listTrackableCanadaPostShipments, updateShipmentStatus } from "@/lib/server/orders";

type ShipmentStatus = "in_transit" | "out_for_delivery" | "delivered" | "exception";

function configured() {
  return Boolean(process.env.CANADA_POST_USERNAME && process.env.CANADA_POST_PASSWORD);
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function xmlValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, "").trim()) : "";
}

function normalizeStatus(description: string, deliveredDate: string): ShipmentStatus {
  const normalized = description.toLocaleLowerCase("fr");
  if (deliveredDate || /delivered|livr[ée]/i.test(normalized)) return "delivered";
  if (/out for delivery|sorti.*livraison|en cours de livraison/i.test(normalized)) return "out_for_delivery";
  if (/exception|delay|retard|attempt|tentative|incorrect|unable|impossible/i.test(normalized))
    return "exception";
  return "in_transit";
}

export async function getCanadaPostTracking(trackingNumber: string) {
  if (!configured()) return null;
  if (!/^[A-Za-z0-9]{11,20}$/.test(trackingNumber)) throw new Error("Invalid Canada Post tracking number");
  const hostname =
    process.env.CANADA_POST_ENVIRONMENT === "production" ? "soa-gw.canadapost.ca" : "ct.soa-gw.canadapost.ca";
  const credentials = Buffer.from(
    `${process.env.CANADA_POST_USERNAME}:${process.env.CANADA_POST_PASSWORD}`,
  ).toString("base64");
  const response = await fetch(
    `https://${hostname}/vis/track/pin/${encodeURIComponent(trackingNumber)}/detail`,
    {
      headers: {
        Accept: "application/vnd.cpc.track-v2+xml",
        "Accept-Language": "fr-CA",
        Authorization: `Basic ${credentials}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!response.ok) throw new Error(`Canada Post responded with ${response.status}`);
  const xml = await response.text();
  const description = xmlValue(xml, "event-description") || "Mise à jour du transporteur.";
  const deliveredDate = xmlValue(xml, "actual-delivery-date");
  const expectedDeliveryDate = xmlValue(xml, "expected-delivery-date");
  const eventDate = xmlValue(xml, "event-date");
  const eventTime = xmlValue(xml, "event-time");
  const location = [xmlValue(xml, "event-site"), xmlValue(xml, "event-province")].filter(Boolean).join(", ");
  return {
    status: normalizeStatus(description, deliveredDate),
    description,
    expectedDeliveryDate: expectedDeliveryDate || null,
    eventAt: [eventDate, eventTime].filter(Boolean).join("T") || null,
    location: location || null,
  };
}

export async function syncCanadaPostTracking() {
  if (!configured()) return { checked: 0, updated: 0, failed: 0 };
  const shipments = await listTrackableCanadaPostShipments();
  let updated = 0;
  let failed = 0;
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < shipments.length) {
      const shipmentIndex = nextIndex;
      nextIndex += 1;
      const shipment = shipments[shipmentIndex];
      try {
        const tracking = await getCanadaPostTracking(shipment.tracking_number);
        if (tracking && tracking.status !== shipment.status) {
          const changed = await updateShipmentStatus({
            shipmentId: shipment.id,
            status: tracking.status,
            message: tracking.description,
            metadata: {
              expectedDeliveryDate: tracking.expectedDeliveryDate,
              eventAt: tracking.eventAt,
              location: tracking.location,
            },
          });
          if (changed) updated += 1;
        }
      } catch {
        failed += 1;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, shipments.length) }, () => worker()));
  return { checked: shipments.length, updated, failed };
}
