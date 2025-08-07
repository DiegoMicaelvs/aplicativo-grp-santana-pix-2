import { QueryClient } from "@tanstack/react-query";

/**
 * Utility function to invalidate all related queries after a mutation
 * This helps prevent stale data issues across different components
 */
export const invalidateRelatedQueries = (
  queryClient: QueryClient,
  type: 'user' | 'referral' | 'withdrawal' | 'company' | 'indicator' | 'all'
) => {
  switch (type) {
    case 'user':
      // Invalidate all user-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/indicadores'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/promoters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/analysts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/team/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/promoter/indicators'] });
      break;
      
    case 'referral':
      // Invalidate all referral-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/referrals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/referrals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analyst/referrals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/promoter/team-referrals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales/available-referrals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/team/stats'] });
      break;
      
    case 'withdrawal':
      // Invalidate all withdrawal and financial-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/admin/withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cash-flow'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] }); // User balance might have changed
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      break;
      
    case 'company':
      // Invalidate all company-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/admin/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      break;
      
    case 'indicator':
      // Invalidate all indicator-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/users/indicadores'] });
      queryClient.invalidateQueries({ queryKey: ['/api/promoter/indicators'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/team/stats'] });
      break;
      
    case 'all':
      // Invalidate all queries (use sparingly)
      queryClient.invalidateQueries();
      break;
  }
};

/**
 * Utility function to refetch specific queries immediately
 * Use this when you need immediate data consistency
 */
export const refetchRelatedQueries = async (
  queryClient: QueryClient,
  queryKeys: string[][]
) => {
  const refetchPromises = queryKeys.map(key => 
    queryClient.refetchQueries({ queryKey: key })
  );
  await Promise.all(refetchPromises);
};