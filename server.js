async function getBootstrap() {
  let client;
  try {
    client = await pool.connect();
    const usersRes = await client.query("SELECT name, role, pin_code FROM app_users WHERE active = TRUE ORDER BY name ASC");
    const itemsRes = await client.query("SELECT code, name, category, qty, min, supplier, note FROM items ORDER BY name ASC");
    const historyRes = await client.query("SELECT at, user_name as user, type, qty, item_code as \"itemCode\", item_name as \"itemName\", destination FROM stock_history ORDER BY at DESC LIMIT 100");
    const requestsRes = await client.query("SELECT id, at, technician, item_code as \"itemCode\", item_name as \"itemName\", destination, qty, status FROM requests WHERE status = 'pending' ORDER BY at DESC");

    const destsRes = await client.query("SELECT name FROM destinations ORDER BY name ASC");
    const destinations = destsRes.rows.map(d => d.name);

    let usageKpis = [];
    try {
      const kpisRes = await client.query(`
        SELECT item_code as "itemCode", item_name as "itemName", user_name as technician,
               CEIL(AVG(days_step))::INT as "averageDays"
        FROM (
          SELECT item_code, item_name, user_name,
                 EXTRACT(DAY FROM (at - LAG(at) OVER (PARTITION BY item_code, user_name ORDER BY at ASC))) as days_step
          FROM stock_history
          WHERE type = 'Retirada'
        ) sub
        WHERE days_step IS NOT NULL AND days_step > 0
        GROUP BY item_code, item_name, user_name
        ORDER BY "averageDays" ASC
      `);
      usageKpis = kpisRes.rows;
    } catch (kpiError) {}

    return {
      users: usersRes.rows.map(u => ({ name: u.name, role: u.role, pin: u.pin_code || "1111" })),
      technicians: usersRes.rows.filter(u => u.role === "tecnico").map(u => u.name),
      destinations: destinations.length > 0 ? destinations : ["Bancada 01", "Bancada 02", "Bancada 03", "Bancada 04", "Bancada 05", "Bancada 06", "Teste"],
      items: itemsRes.rows,
      history: historyRes.rows,
      requests: requestsRes.rows,
      usageKpis: usageKpis,
      adminName: "Administrador"
    };
  } catch (dbError) {
    console.error("Erro ao buscar dados do banco. Usando usuários locais de emergência:", dbError.message);
    
    // FALLBACK: Se o banco falhar por rede, entrega os usuários padrão temporariamente para permitir o login básico
    return {
      users: [
        { name: "Administrador", role: "admin", pin: "Out@adm" },
        { name: "Luiz", role: "tecnico", pin: "1111" },
        { name: "Bruno", role: "tecnico", pin: "1111" },
        { name: "Joao", role: "tecnico", pin: "1111" },
        { name: "Placo", role: "tecnico", pin: "1111" },
        { name: "Kaique", role: "tecnico", pin: "1111" },
        { name: "Cauã", role: "tecnico", pin: "1111" }
      ],
      technicians: ["Luiz", "Bruno", "Joao", "Placo", "Kaique", "Cauã"],
      destinations: ["Bancada 01", "Bancada 02", "Bancada 03", "Bancada 04", "Bancada 05", "Bancada 06", "Teste"],
      items: [],
      history: [],
      requests: [],
      usageKpis: [],
      adminName: "Administrador"
    };
  } finally {
    if (client) client.release();
  }
}
