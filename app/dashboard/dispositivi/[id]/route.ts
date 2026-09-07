import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/prisma/db";

type DeviceRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: DeviceRouteProps
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Non autenticato." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const deviceId = Number(id);

    if (!Number.isInteger(deviceId)) {
      return NextResponse.json(
        { error: "Dispositivo non valido." },
        { status: 400 }
      );
    }

    const device = await db.orm.public.Device
      .where({
        id: deviceId,
        userId: session.user.id,
      })
      .first();

    if (!device) {
      return NextResponse.json(
        { error: "Dispositivo non trovato." },
        { status: 404 }
      );
    }

    await db.orm.public.Device
      .where({
        id: deviceId,
        userId: session.user.id,
      })
      .delete();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Delete device error:", error);

    return NextResponse.json(
      { error: "Errore durante l'eliminazione del dispositivo." },
      { status: 500 }
    );
  }
}