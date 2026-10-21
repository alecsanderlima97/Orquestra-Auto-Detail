export default function handler(_req, res) {
  return res.status(410).json({
    error: 'Este endpoint foi substituído pelo consumo seguro via Firebase Function.'
  });
}
