import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuth } from "@/lib/auth";

/**
 * PHASE 3: GOLD SHOP [RE-SYNC ATTEMPT]
 * Version: 1.0.1
 */

interface ShopItem {
    id: string;
    name: string;
    description: string;
    cost: number;
    type: "consumable" | "cosmetic";
    icon: string;
    limit?: number; // Max quantity holdable
}

const SHOP_ITEMS: ShopItem[] = [
    {
        id: "streak_freeze",
        name: "Streak Freeze",
        description: "Prevents your streak from resetting if you miss a day. Max 1.",
        cost: 200,
        type: "consumable",
        icon: "Snowflake",
        limit: 1,
    },
    {
        id: "theme_midnight",
        name: "Theme: Midnight",
        description: "A deep, dark blue theme for late night study sessions.",
        cost: 1000,
        type: "cosmetic",
        icon: "Moon",
    },
    {
        id: "theme_royal",
        name: "Theme: Royal",
        description: "Add a touch of gold elegance to your interface.",
        cost: 5000,
        type: "cosmetic",
        icon: "Crown",
    },
    {
        id: "profile_update",
        name: "Profile Image Update",
        description: "Unlock the ability to change your profile picture once.",
        cost: 500,
        type: "consumable",
        icon: "Image",
        limit: 99,
    },
    {
        id: "frame_blue_neon",
        name: "Blue Neon Frame",
        description: "A futuristic glowing neon frame.",
        cost: 500,
        type: "cosmetic",
        icon: "/frames/frame-blue-neon.png", // Using the path directly as icon
    },
    {
        id: "frame_bronze",
        name: "Bronze Frame",
        description: "A classic bronze frame for participants.",
        cost: 200,
        type: "cosmetic",
        icon: "/frames/bronze.png",
    },
];

export async function GET(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    return NextResponse.json({ items: SHOP_ITEMS });
}

export async function POST(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { itemId } = await request.json();
    const item = SHOP_ITEMS.find((i) => i.id === itemId);

    if (!item) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const userRef = adminDb.collection("users").doc(authResult.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data()!;
    const currentGold = userData.totalGold || 0;
    const inventory = userData.inventory || [];
    const streakFreezes = userData.streakFreezes || 0;

    // 1. Check Balance
    if (currentGold < item.cost) {
        return NextResponse.json({ error: "Insufficient Gold" }, { status: 400 });
    }

    // 2. Check Constraints
    if (item.type === "consumable") {
        if (item.id === "streak_freeze" && streakFreezes >= (item.limit || 1)) {
            return NextResponse.json({ error: "You already have a Streak Freeze" }, { status: 400 });
        }
    } else if (item.type === "cosmetic") {
        if (inventory.includes(item.id)) {
            return NextResponse.json({ error: "You already own this item" }, { status: 400 });
        }
    }

    // 3. Process Purchase
    const updates: Record<string, unknown> = {
        totalGold: FieldValue.increment(-item.cost),
    };

    if (item.type === "consumable") {
        if (item.id === "streak_freeze") {
            updates.streakFreezes = FieldValue.increment(1);
        } else if (item.id === "profile_update") {
            updates.profileUpdates = FieldValue.increment(1);
        }
    } else if (item.type === "cosmetic") {
        updates.inventory = FieldValue.arrayUnion(item.id);

        // Auto-equip logic
        if (item.id.startsWith("theme_")) {
            updates.activeTheme = item.id;
        } else if (item.id.startsWith("frame_")) {
            updates.frame = item.icon; // Store the URL/Path
        }
    }

    await userRef.update(updates);

    return NextResponse.json({ success: true, message: `Purchased ${item.name}` });
}
