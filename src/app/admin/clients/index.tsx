import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  AdminScreen,
  Caption,
  EmptyBox,
  ErrorBox,
  Group,
  LinkRow,
  Loading,
  Searchbar,
  fmtKm,
  useAdminLoad,
} from "../../../components/admin/AdminUi";
import { AppText } from "../../../components/ui/AppText";
import { Avatar } from "../../../components/ui/Avatar";
import type { UserProfile } from "../../../interfaces/user";
import { fetchClients } from "../../../services/adminStatsService";
import { spacing } from "../../../theme/tokens";

const fullName = (p: UserProfile): string =>
  `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Rider";

/** "Joined Mar 2025", or empty when the date is missing. */
const joinedLabel = (iso?: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `Joined ${d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`;
};

export default function AdminClients() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const load = useCallback(() => fetchClients(), []);
  const { data, loading, error, refreshing, reload, onRefresh } = useAdminLoad(
    load,
    "Couldn't load riders. Check your connection and try again.",
  );

  const visible = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return term
      ? data.filter((c) => fullName(c).toLowerCase().includes(term))
      : data;
  }, [data, search]);
  const count = data?.length ?? 0;

  return (
    <AdminScreen refreshing={refreshing} onRefresh={onRefresh} gap={spacing.md}>
      <Searchbar
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name"
      />
      <Caption
        text={
          data
            ? `${count} ${count === 1 ? "rider" : "riders"} · A–Z · test accounts hidden`
            : " "
        }
      />
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : visible.length === 0 ? (
        <EmptyBox
          text={
            search.trim()
              ? "No riders match that name."
              : "No riders registered yet."
          }
        />
      ) : (
        <Group>
          {visible.map((c) => (
            <LinkRow
              key={c.uid}
              tall
              left={
                <Avatar
                  firstName={c.firstName}
                  lastName={c.lastName}
                  photoUrl={c.photoUrl}
                  size={44}
                />
              }
              title={fullName(c)}
              sub={joinedLabel(c.createdAt)}
              right={
                <View style={styles.stat}>
                  <AppText variant="bodyStrong">
                    {fmtKm(Number(c.totalKmTravelled) || 0)}
                  </AppText>
                  <AppText variant="eyebrow" color="textMuted">
                    KM
                  </AppText>
                </View>
              }
              onPress={() =>
                router.push({
                  pathname: "/admin/clients/[id]",
                  params: { id: c.uid },
                } as never)
              }
            />
          ))}
        </Group>
      )}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  stat: { alignItems: "flex-end" },
});
