import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { TripCompletePanel } from "../../../components/rides/TripCompletePanel";
import { LoadingScreen } from "../../../components/ui/LoadingScreen";
import { Screen } from "../../../components/ui/Screen";
import { useAuth } from "../../../contexts/AuthContext";
import type { RideRequest } from "../../../interfaces/ride";
import { subscribeRide } from "../../../services/rideService";
import { spacing } from "../../../theme/tokens";

/**
 * "You've arrived" as its own screen, opened by TripCompletionWatcher when
 * a trip finishes while the rider is anywhere but the live map. Rate or
 * skip, then the trip's history page takes over.
 */
export default function TripComplete() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userProfile } = useAuth();
  const [ride, setRide] = useState<RideRequest | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    return subscribeRide(id, setRide, () => setRide(null));
  }, [id]);

  useEffect(() => {
    if (ride === null) router.navigate("/(client)");
  }, [ride, router]);

  if (!ride) return <LoadingScreen />;

  return (
    <Screen scroll>
      <View style={styles.body}>
        <TripCompletePanel
          ride={ride}
          riderFirstName={userProfile?.firstName}
          onDone={() =>
            router.replace({
              pathname: "/(common)/history/[id]",
              params: { id: ride.id as string },
            })
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: spacing.xxl, paddingBottom: spacing.xl },
});
