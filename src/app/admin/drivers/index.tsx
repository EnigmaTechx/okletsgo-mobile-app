import { useCallback, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  AdminScreen,
  Caption,
  EmptyBox,
  ErrorBox,
  Group,
  LinkRow,
  Loading,
  Pill,
  Searchbar,
  driverStatusPill,
  useAdminLoad,
  vehicleLabel,
} from "../../../components/admin/AdminUi";
import { Avatar } from "../../../components/ui/Avatar";
import { useTheme } from "../../../contexts/ThemeContext";
import type { UserProfile } from "../../../interfaces/user";
import { fetchDrivers } from "../../../services/adminStatsService";
import { spacing } from "../../../theme/tokens";

const fullName = (p: UserProfile): string =>
  `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Driver";

export default function AdminDrivers() {
  const router = useRouter();
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const load = useCallback(() => fetchDrivers(), []);
  const { data, loading, error, refreshing, reload, onRefresh } = useAdminLoad(
    load,
    "Couldn't load drivers. Check your connection and try again.",
  );

  const visible = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return term
      ? data.filter((d) => fullName(d).toLowerCase().includes(term))
      : data;
  }, [data, search]);
  const count = data?.length ?? 0;
  const online = data?.filter((d) => d.isOnline).length ?? 0;

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
            ? `${count} ${count === 1 ? "driver" : "drivers"} · ${online} online · test accounts hidden`
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
              ? "No drivers match that name."
              : "No drivers registered yet."
          }
        />
      ) : (
        <Group>
          {visible.map((d) => {
            const pill = driverStatusPill(d);
            return (
              <LinkRow
                key={d.uid}
                tall
                left={
                  <Avatar
                    firstName={d.firstName}
                    lastName={d.lastName}
                    photoUrl={d.photoUrl}
                    size={44}
                    tint={colors.primary}
                  />
                }
                title={fullName(d)}
                sub={vehicleLabel(d)}
                right={<Pill tone={pill.tone} label={pill.label} />}
                onPress={() =>
                  router.push({
                    pathname: "/admin/drivers/[id]",
                    params: { id: d.uid },
                  } as never)
                }
              />
            );
          })}
        </Group>
      )}
    </AdminScreen>
  );
}
