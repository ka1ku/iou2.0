import React, { createContext, useContext, useReducer, useMemo, useEffect } from 'react';
import { getCurrentUser } from '../services/authService';

export const EXPENSE_ACTIONS = {
  SET_TITLE: 'SET_TITLE',
  SET_PARTICIPANTS: 'SET_PARTICIPANTS',
  SET_SELECTED_FRIENDS: 'SET_SELECTED_FRIENDS',
  SET_ITEMS: 'SET_ITEMS',
  ADD_ITEM: 'ADD_ITEM',
  UPDATE_ITEM: 'UPDATE_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  SET_FEES: 'SET_FEES',
  ADD_FEE: 'ADD_FEE',
  UPDATE_FEE: 'UPDATE_FEE',
  REMOVE_FEE: 'REMOVE_FEE',
  SET_SELECTED_PAYERS: 'SET_SELECTED_PAYERS',
  SET_JOIN_ENABLED: 'SET_JOIN_ENABLED',
  SET_LOADING: 'SET_LOADING',
  SET_PARTICIPANTS_EXPANDED: 'SET_PARTICIPANTS_EXPANDED',
  RESET_STATE: 'RESET_STATE',
  INITIALIZE_FROM_EXPENSE: 'INITIALIZE_FROM_EXPENSE',
  UPDATE_USER_PARTICIPANT: 'UPDATE_USER_PARTICIPANT',
};

const createInitialState = (userProfile) => {
  const currentUserId = getCurrentUser()?.uid;
  const userName = userProfile 
    ? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() 
    : 'Me';
  
  return {
    title: '',
    participants: [
      {
        name: userName,
        id: 'me-participant',
        userId: currentUserId,
        placeholder: false,
        phoneNumber: userProfile?.phoneNumber || null,
        username: userProfile?.username || null,
        profilePhoto: userProfile?.profilePhoto || null,
      },
    ],
    selectedFriends: [],
    items: [
      {
        id: Date.now().toString(),
        name: '',
        amount: 0,
        selectedConsumers: [0],
        splits: [],
        selectedPayers: [0],
      },
    ],
    fees: [],
    selectedPayers: [0],
    joinEnabled: true,
    loading: false,
    participantsExpanded: false,
  };
};

const expenseReducer = (state, action) => {
  switch (action.type) {
    case EXPENSE_ACTIONS.SET_TITLE:
      return { ...state, title: action.payload };

    case EXPENSE_ACTIONS.SET_PARTICIPANTS:
      return { ...state, participants: action.payload };

    case EXPENSE_ACTIONS.SET_SELECTED_FRIENDS:
      return { ...state, selectedFriends: action.payload };

    case EXPENSE_ACTIONS.SET_ITEMS:
      return { ...state, items: action.payload };

    case EXPENSE_ACTIONS.ADD_ITEM:
      const lastItem = state.items[state.items.length - 1];
      const payersToUse = lastItem?.selectedPayers || [0];
      const newItem = {
        id: Date.now().toString(),
        name: '',
        amount: 0,
        selectedConsumers: [],
        splits: [],
        selectedPayers: payersToUse,
      };
      return { ...state, items: [...state.items, newItem] };

    case EXPENSE_ACTIONS.UPDATE_ITEM:
      return {
        ...state,
        items: state.items.map((item, index) =>
          index === action.payload.index ? { ...item, ...action.payload.updates } : item
        ),
      };

    case EXPENSE_ACTIONS.REMOVE_ITEM:
      return {
        ...state,
        items: state.items.filter((_, index) => index !== action.payload),
      };

    case EXPENSE_ACTIONS.SET_FEES:
      return { ...state, fees: action.payload };

    case EXPENSE_ACTIONS.ADD_FEE:
      const newFee = {
        id: Date.now().toString(),
        name: action.payload.name || '',
        amount: parseFloat(action.payload.amount) || 0,
        type: action.payload.type || 'fixed',
        percentage: action.payload.percentage || null,
        splitType: action.payload.splitType || 'proportional',
        splits: action.payload.splits || [],
        ...action.payload
      };
      return { ...state, fees: [...state.fees, newFee] };

    case EXPENSE_ACTIONS.UPDATE_FEE:
      return {
        ...state,
        fees: state.fees.map((fee, index) =>
          index === action.payload.index ? { ...fee, ...action.payload.updates } : fee
        ),
      };

    case EXPENSE_ACTIONS.REMOVE_FEE:
      return {
        ...state,
        fees: state.fees.filter((_, index) => index !== action.payload),
      };

    case EXPENSE_ACTIONS.SET_SELECTED_PAYERS:
      return { ...state, selectedPayers: action.payload };

    case EXPENSE_ACTIONS.SET_JOIN_ENABLED:
      return { ...state, joinEnabled: action.payload };

    case EXPENSE_ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };

    case EXPENSE_ACTIONS.SET_PARTICIPANTS_EXPANDED:
      return { ...state, participantsExpanded: action.payload };

    case EXPENSE_ACTIONS.RESET_STATE:
      return createInitialState(action.payload?.userProfile);

    case EXPENSE_ACTIONS.UPDATE_USER_PARTICIPANT:
      const { userProfile } = action.payload;
      const currentUser = getCurrentUser();
      if (!currentUser || !userProfile) return state;
      
      const userName = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim();
      const updatedParticipants = state.participants.map((p) => {
        if (p.userId === currentUser.uid) {
          return {
            ...p,
            name: userName,
            phoneNumber: userProfile.phoneNumber || null,
            username: userProfile.username || null,
            profilePhoto: userProfile.profilePhoto || null,
          };
        }
        return p;
      });
      
      return { ...state, participants: updatedParticipants };

    case EXPENSE_ACTIONS.INITIALIZE_FROM_EXPENSE:
      const { expense, isEditing, isNewExpense, userProfile: initUserProfile } = action.payload;
      if (!expense || (!isEditing && !isNewExpense)) {
        return state;
      }

      const currentUserId = getCurrentUser()?.uid;
      
      const currentUserParticipant = expense.participants?.find(p => p.userId === currentUserId);
      const currentUserName = currentUserParticipant?.name || 
        (initUserProfile ? `${initUserProfile.firstName || ''} ${initUserProfile.lastName || ''}`.trim() : 'Me');
      
      const existingFriends = expense.participants
        .filter(
          (p) =>
            p.userId !== currentUserId &&
            !p.placeholder &&
            p.userId
        )
        .map((p) => ({
          id: p.userId,
          name: p.name,
          phoneNumber: p.phoneNumber,
          username: p.username,
          profilePhoto: p.profilePhoto,
        }));

      const newParticipants = [
        {
          name: currentUserName,
          id: 'me-participant',
          userId: currentUserId,
          placeholder: false,
          phoneNumber: currentUserParticipant?.phoneNumber || initUserProfile?.phoneNumber || null,
          username: currentUserParticipant?.username || initUserProfile?.username || null,
          profilePhoto: currentUserParticipant?.profilePhoto || initUserProfile?.profilePhoto || null,
        },
        ...existingFriends.map((friend, index) => ({
          name: friend.name || '',
          id: `friend-${friend.id || index}`,
          userId: friend.id || null,
          phoneNumber: friend.phoneNumber || null,
          username: friend.username || null,
          profilePhoto: friend.profilePhoto || null,
          placeholder: false,
        })),
      ];

      const itemsWithPayers =
        expense.items?.map((item) => ({
          ...item,
          selectedPayers: item.selectedPayers || [0],
          selectedConsumers: item.selectedConsumers || [0],
        })) || state.items;

      return {
        ...state,
        selectedFriends: existingFriends,
        participants: newParticipants,
        title: expense.title || '',
        joinEnabled: expense.join?.enabled ?? true,
        fees: expense.fees || [],
        items: itemsWithPayers,
        selectedPayers: expense.selectedPayers || [0],
      };

    default:
      return state;
  }
};

const ExpenseContext = createContext();

export const ExpenseProvider = ({ children, userProfile }) => {
  const [state, dispatch] = useReducer(expenseReducer, null, () => createInitialState(userProfile));

  useEffect(() => {
    if (userProfile) {
      dispatch({ 
        type: EXPENSE_ACTIONS.UPDATE_USER_PARTICIPANT, 
        payload: { userProfile } 
      });
    }
  }, [userProfile]);

  const total = useMemo(() => {
    return (
      state.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
      state.fees.reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0)
    );
  }, [state.items, state.fees]);

  const actions = useMemo(() => ({
    setTitle: (title) => dispatch({ type: EXPENSE_ACTIONS.SET_TITLE, payload: title }),
    
    setParticipants: (participants) => 
      dispatch({ type: EXPENSE_ACTIONS.SET_PARTICIPANTS, payload: participants }),
    
    setSelectedFriends: (friends) => 
      dispatch({ type: EXPENSE_ACTIONS.SET_SELECTED_FRIENDS, payload: friends }),
    
    setItems: (items) => dispatch({ type: EXPENSE_ACTIONS.SET_ITEMS, payload: items }),
    
    addItem: () => dispatch({ type: EXPENSE_ACTIONS.ADD_ITEM }),
    
    updateItem: (index, updates) => 
      dispatch({ type: EXPENSE_ACTIONS.UPDATE_ITEM, payload: { index, updates } }),
    
    removeItem: (index) => 
      dispatch({ type: EXPENSE_ACTIONS.REMOVE_ITEM, payload: index }),
    
    setFees: (fees) => dispatch({ type: EXPENSE_ACTIONS.SET_FEES, payload: fees }),
    
    addFee: (fee) => dispatch({ type: EXPENSE_ACTIONS.ADD_FEE, payload: fee }),
    
    updateFee: (index, updates) => 
      dispatch({ type: EXPENSE_ACTIONS.UPDATE_FEE, payload: { index, updates } }),
    
    removeFee: (index) => 
      dispatch({ type: EXPENSE_ACTIONS.REMOVE_FEE, payload: index }),
    
    setSelectedPayers: (payers) => 
      dispatch({ type: EXPENSE_ACTIONS.SET_SELECTED_PAYERS, payload: payers }),
    
    setJoinEnabled: (enabled) => 
      dispatch({ type: EXPENSE_ACTIONS.SET_JOIN_ENABLED, payload: enabled }),
    
    setLoading: (loading) => 
      dispatch({ type: EXPENSE_ACTIONS.SET_LOADING, payload: loading }),
    
    setParticipantsExpanded: (expanded) => 
      dispatch({ type: EXPENSE_ACTIONS.SET_PARTICIPANTS_EXPANDED, payload: expanded }),
    
    resetState: (userProfile) => dispatch({ 
      type: EXPENSE_ACTIONS.RESET_STATE, 
      payload: { userProfile } 
    }),
    
    initializeFromExpense: (expense, isEditing, isNewExpense) => 
      dispatch({ 
        type: EXPENSE_ACTIONS.INITIALIZE_FROM_EXPENSE, 
        payload: { expense, isEditing, isNewExpense, userProfile } 
      }),
      
    updateUserParticipant: (userProfile) => 
      dispatch({ 
        type: EXPENSE_ACTIONS.UPDATE_USER_PARTICIPANT, 
        payload: { userProfile } 
      }),
  }), [userProfile]);

  const value = useMemo(() => ({
    state,
    actions,
    total,
  }), [state, actions, total]);

  return (
    <ExpenseContext.Provider value={value}>
      {children}
    </ExpenseContext.Provider>
  );
};

export const useExpense = () => {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpense must be used within an ExpenseProvider');
  }
  return context;
};

export default ExpenseContext;
