export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      username?: string;
      password?: string;
    };
    const username = (body.username || "Gustavo").trim();
    if (!username) {
      return Response.json(
        { error: "Informe o nome de usuario." },
        { status: 400 }
      );
    }

    const name = username.charAt(0).toUpperCase() + username.slice(1);
    const userId = "user_" + username.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const storeId = "store_" + username.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const dataOwnerId = userId;

    const userPayload = {
      id: userId,
      username: username,
      name: name,
      role: "admin",
      storeId: storeId,
      dataOwnerId: dataOwnerId,
      iat: Date.now(),
    };

    const token =
      "dm_" + Buffer.from(JSON.stringify(userPayload)).toString("base64url");

    return Response.json({
      access_token: token,
      user: {
        id: userId,
        username: username,
        name: name,
        role: "admin",
        storeId: storeId,
      },
    });
  } catch {
    return Response.json(
      { error: "Erro ao processar login." },
      { status: 500 }
    );
  }
}
