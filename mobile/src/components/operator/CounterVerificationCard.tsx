
import { useState } from "react";
import { View } from "react-native";

import {
  AppText,
  Button,
  GlassCard,
  useToast,
} from "@/components/ui";
import {
  verifyOperatorBookingAtCounter,
  type OperatorBooking,
} from "@/services/operatorApi";
import { formatMYT } from "@/utils/datetime";
import { describeError } from "@/utils/errors";

export default function CounterVerificationCard({
  booking,
  onUpdated,
}: {
  booking: OperatorBooking;
  onUpdated: () => Promise<void>;
}) {
  const toast = useToast();

  const [identity, setIdentity] = useState(false);
  const [licence, setLicence] = useState(false);
  const [permit, setPermit] = useState(false);
  const [saving, setSaving] = useState(false);

  const details = booking.bookingDetails || {};

  const permitRequired =
    details.internationalPermitRequired === true ||
    (
      details.internationalPermitRequired == null &&
      details.driver?.internationalPermitRequired === true
    );

  const record = details.counterVerification;

  const completed =
    record?.identityMatched === true &&
    record?.licenceSighted === true &&
    record?.permitRequired === permitRequired &&
    (!permitRequired || record?.permitSighted === true);

  if (
    booking.serviceType !== "CAR_RENTAL" ||
    (
      booking.status !== "READY_FOR_PICKUP" &&
      !record
    )
  ) {
    return null;
  }

  const submit = async () => {
    try {
      setSaving(true);

      await verifyOperatorBookingAtCounter(
        booking.id,
        {
          identityMatched: identity,
          licenceSighted: licence,
          permitSighted: permitRequired ? permit : false,
        }
      );

      toast.show("Counter verification completed.", {
        tone: "ok",
      });

      await onUpdated();
    } catch (err) {
      toast.show(describeError(err).message, {
        tone: "err",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassCard>
      <View style={{ gap: 14 }}>
        <AppText variant="headline">
          Counter Verification
        </AppText>

        {completed ? (
          <>
            <AppText variant="bodyStrong">
              Verified at counter
            </AppText>

            <AppText variant="caption">
              {formatMYT(
                record.verifiedAt,
                "dayDateTime"
              )}
            </AppText>
          </>
        ) : booking.status !== "READY_FOR_PICKUP" ? (
          <AppText variant="caption">
            Counter verification is available when
            this booking is ready for pickup.
          </AppText>
        ) : (
          <>
            <AppText variant="caption">
              Check the original documents presented
              by the driver before confirming.
            </AppText>

            <Button
              label={
                identity
                  ? "✓ Driver identity matches"
                  : "Confirm driver identity"
              }
              variant="line"
              onPress={() => setIdentity(!identity)}
            />

            <Button
              label={
                licence
                  ? "✓ Physical driving licence checked"
                  : "Check physical driving licence"
              }
              variant="line"
              onPress={() => setLicence(!licence)}
            />

            {permitRequired && (
              <Button
                label={
                  permit
                    ? "✓ Physical IDP checked"
                    : "Check physical IDP"
                }
                variant="line"
                onPress={() => setPermit(!permit)}
              />
            )}

            <Button
              label="Confirm Counter Verification"
              variant="brand"
              loading={saving}
              disabled={
                saving ||
                !identity ||
                !licence ||
                (permitRequired && !permit)
              }
              onPress={submit}
            />
          </>
        )}
      </View>
    </GlassCard>
  );
}
