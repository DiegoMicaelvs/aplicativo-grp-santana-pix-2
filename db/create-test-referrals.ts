import { db } from "./index";
import { referrals, users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function createTestReferrals() {
  try {
    console.log("Criando indicações de teste...");

    // Buscar usuários indicadores ativos
    const indicadores = await db.query.users.findMany({
      where: eq(users.role, "indicador")
    });

    if (indicadores.length === 0) {
      console.log("Nenhum indicador encontrado. Criando um indicador de teste...");
      
      const [newIndicador] = await db.insert(users).values({
        username: "indicador.teste@email.com",
        password: "$2a$10$9ZXq0K7vT5Xh3vP2B4C5Ku9L8jR7mU6nW5Y1z", // senha: 123456
        fullName: "João Teste Indicador",
        phone: "11987654321",
        cpf: "12345678901",
        address: "Rua Teste, 123",
        pixKey: "joao@teste.com",
        bankName: "Banco Teste",
        agency: "1234",
        account: "56789-0",
        role: "indicador",
        balance: 0,
        totalEarnings: 0,
        isActive: true
      }).returning();

      indicadores.push(newIndicador);
    }

    // Dados de teste para indicações
    const testReferrals = [
      {
        fullName: "Maria Silva Santos",
        phone: "11987654321",
        licensePlate: "ABC-1234",
        hasInsurance: false,
        vehicleBrand: "Honda", 
        vehicleModel: "Civic",
        vehicleYear: "2020"
      },
      {
        fullName: "Carlos Eduardo Oliveira", 
        phone: "11976543210",
        licensePlate: "XYZ-5678",
        hasInsurance: true,
        vehicleBrand: "Toyota",
        vehicleModel: "Corolla", 
        vehicleYear: "2019"
      },
      {
        fullName: "Ana Paula Costa",
        phone: "11965432109", 
        licensePlate: "DEF-9012",
        hasInsurance: false,
        vehicleBrand: "Volkswagen",
        vehicleModel: "Gol",
        vehicleYear: "2021"
      },
      {
        fullName: "Roberto Ferreira Lima",
        phone: "11954321098",
        licensePlate: "GHI-3456", 
        hasInsurance: true,
        vehicleBrand: "Chevrolet",
        vehicleModel: "Onix",
        vehicleYear: "2022"
      },
      {
        fullName: "Juliana Machado",
        phone: "11943210987",
        licensePlate: "JKL-7890",
        hasInsurance: false,
        vehicleBrand: "Fiat",
        vehicleModel: "Argo",
        vehicleYear: "2020"
      },
      {
        fullName: "Pedro Henrique Souza",
        phone: "11932109876",
        licensePlate: "MNO-2345",
        hasInsurance: true, 
        vehicleBrand: "Hyundai",
        vehicleModel: "HB20",
        vehicleYear: "2021"
      },
      {
        fullName: "Fernanda Alves Rocha",
        phone: "11921098765",
        licensePlate: "PQR-6789",
        hasInsurance: false,
        vehicleBrand: "Nissan",
        vehicleModel: "March",
        vehicleYear: "2019"
      },
      {
        fullName: "Lucas Gabriel Martins",
        phone: "11910987654",
        licensePlate: "STU-0123", 
        hasInsurance: true,
        vehicleBrand: "Renault",
        vehicleModel: "Sandero",
        vehicleYear: "2022"
      }
    ];

    // Buscar empresa padrão
    const companies = await db.query.companies.findMany();
    const companyId = companies[0]?.id || 1;

    // Criar indicações
    for (let i = 0; i < testReferrals.length; i++) {
      const referralData = testReferrals[i];
      const indicador = indicadores[i % indicadores.length];
      
      const [newReferral] = await db.insert(referrals).values({
        userId: indicador.id,
        createdBy: indicador.id,
        promoterId: indicador.promoterId,
        fullName: referralData.fullName,
        phone: referralData.phone,
        licensePlate: referralData.licensePlate,
        hasInsurance: referralData.hasInsurance,
        companyId: companyId,
        status: "pending",
        vehicleBrand: referralData.vehicleBrand,
        vehicleModel: referralData.vehicleModel,
        vehicleYear: referralData.vehicleYear,
        commissionIndicator: "0.00",
        commissionPromoter: "0.00"
      }).returning();

      console.log(`✓ Indicação criada: ${referralData.fullName} - ${referralData.vehicleBrand} ${referralData.vehicleModel}`);
    }

    console.log("\n🎉 Indicações de teste criadas com sucesso!");
    console.log(`Total de indicações: ${testReferrals.length}`);
    console.log("Agora você pode testar a funcionalidade de validação no painel admin.");

  } catch (error) {
    console.error("Erro ao criar indicações de teste:", error);
  }
}

// Executar se chamado diretamente
createTestReferrals().then(() => process.exit(0)).catch(console.error);

export default createTestReferrals;