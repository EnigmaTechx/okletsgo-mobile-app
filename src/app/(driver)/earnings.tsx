import React from "react";
import { PlaceholderScreen } from "../../components/PlaceholderScreen";
import { AppText } from "../../components/ui/AppText";
import { useFeatureFlags } from "../../contexts/FeatureFlagsContext";

/** Behind the `driver_earnings` remote flag, exactly as in the Ionic app. */
export default function DriverEarnings() {
  const { isVisible } = useFeatureFlags();
  return (
    <PlaceholderScreen title="Earnings" phase={3}>
      <AppText variant="small" color="textMuted">
        {isVisible("driver_earnings")
          ? "The driver_earnings flag includes you."
          : "Hidden by the driver_earnings flag for this account."}
      </AppText>
    </PlaceholderScreen>
  );
}
