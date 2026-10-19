import React from "react";
import { Tabs } from "expo-router";
import { TabBarIcon } from "../../components/TabBarIcon";
import { useTheme } from "../../contexts/ThemeContext";
import { typography } from "../../theme/tokens";

export default function DriverLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarLabelStyle: typography.tab,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="home-outline" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "Trips",
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="car-outline" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Earnings",
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="bar-chart-outline" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="person-outline" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
