import React, { useEffect } from "react";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { TabBarIcon } from "../../components/TabBarIcon";
import { useAuth } from "../../contexts/AuthContext";
import { tabScreenOptions } from "../../components/tabBarOptions";
import { useTheme } from "../../contexts/ThemeContext";

const KEEP_AWAKE_TAG = "driver-online";

export default function DriverLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { userProfile } = useAuth();
  const online = !!userProfile?.isOnline;

  // Screen stays on while the driver is online, across every driver
  // screen, so a request is never missed behind a locked phone.
  useEffect(() => {
    if (!online) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [online]);
  return (
    <Tabs screenOptions={tabScreenOptions(colors, insets)}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="home-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "Trips",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="car-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Earnings",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="bar-chart-outline"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="person-outline" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
